#include "node.h"

#if HAVE_OPENSSL

#include "node_secure_heap.h"
#include "gtest/gtest.h"

using node::secure_heap::Block;
using node::secure_heap::BlockAddress;
using node::secure_heap::HeapInspector;
using node::secure_heap::SecureHeap;

class SecureHeapTest : public ::testing::Test {
 protected:
  void SetUp() override {
  }
};

TEST_F(SecureHeapTest, SimpleAlloc) {
  SecureHeap heap;
  HeapInspector inspector(heap);

  // This should allocate a 256-byte segment, creating multiple buddies.
  void* mem = heap.Alloc(100);
  ASSERT_NE(mem, nullptr);

  BlockAddress mem_ba = heap.GetBlockAddress(mem);
  ASSERT_NE(mem_ba.block, nullptr);
  ASSERT_EQ(mem_ba.block->GetAllocationSize(mem), SECURE_HEAP_MIN_EXP);

  std::vector<Block*> blocks = inspector.GetBlocks();
  ASSERT_EQ(blocks.size(), 1u);
  Block* block = blocks[0];

  // Check that buddies have been created as expected.
  std::vector<BlockAddress> free_slices;
  for (size_t exp = 8; exp <= 11; exp++) {
    free_slices = inspector.GetFreeSlices(exp);
    ASSERT_EQ(free_slices.size(), 1u);
    ASSERT_EQ(free_slices[0].address, static_cast<uint8_t*>(mem) + (1 << exp));
  }

  // This should use one of the new buddies.
  void* mem2 = heap.Alloc(1024);
  ASSERT_NE(mem, nullptr);
  ASSERT_EQ(mem2, static_cast<uint8_t*>(mem) + 1024);

  for (size_t exp = 8; exp <= 11; exp++) {
    free_slices = inspector.GetFreeSlices(exp);
    if (exp == 10) {
      // The only available free slice (buddy) should be in use now.
      ASSERT_TRUE(free_slices.empty());
    } else {
      // Other buddies should still be available.
      ASSERT_EQ(free_slices.size(), 1u);
      ASSERT_EQ(free_slices[0].address, static_cast<uint8_t*>(mem) + (1 << exp));
    }
  }

  // Freeing the smaller segment should cause merges at exponents 8 and 9..
  heap.Free(mem);

  for (size_t exp = SECURE_HEAP_MIN_EXP; exp <= 11; exp++) {
    free_slices = inspector.GetFreeSlices(exp);
    if (exp < 10) {
      // These should have been merged by now.
      ASSERT_TRUE(free_slices.empty());
    } else if (exp == 10) {
      // The merged segments should be here.
      ASSERT_EQ(free_slices.size(), 1u);
      ASSERT_EQ(free_slices[0].address, mem);
    } else {
      // Other buddies should still be available.
      ASSERT_EQ(free_slices.size(), 1u);
      ASSERT_EQ(free_slices[0].address, static_cast<uint8_t*>(mem) + (1 << exp));
    }
  }

  // Freeing the only allocated segment should release the whole block.
  heap.Free(mem2);

  blocks = inspector.GetBlocks();
  ASSERT_TRUE(blocks.empty());
}

TEST_F(SecureHeapTest, IntegrationOpenSSL) {
  SecureHeap heap;
  HeapInspector inspector(heap);

  ASSERT_FALSE(CRYPTO_secure_malloc_initialized());

  void* unprotected = OPENSSL_secure_malloc(64);
  ASSERT_NE(unprotected, nullptr);
  ASSERT_FALSE(CRYPTO_secure_allocated(unprotected));

  heap.ActivatePerProcess();
  ASSERT_TRUE(CRYPTO_secure_malloc_initialized());
  ASSERT_EQ(CRYPTO_secure_used(), 0u);

  void* protected64 = OPENSSL_secure_malloc(64);
  ASSERT_NE(protected64, nullptr);
  ASSERT_TRUE(CRYPTO_secure_allocated(protected64));
  ASSERT_EQ(CRYPTO_secure_actual_size(protected64), 256u);
  ASSERT_EQ(CRYPTO_secure_used(), 256u);

  void* protected1000 = OPENSSL_secure_malloc(1000);
  ASSERT_NE(protected64, nullptr);
  ASSERT_TRUE(CRYPTO_secure_allocated(protected1000));
  ASSERT_EQ(CRYPTO_secure_actual_size(protected1000), 1024u);
  ASSERT_EQ(CRYPTO_secure_used(), 1024u + 256u);

  // The secure heap implementation should detect that previously allocated
  // memory is not part of the secure heap and allow freeing it.
  ASSERT_FALSE(CRYPTO_secure_allocated(unprotected));
  OPENSSL_secure_free(unprotected);

  // This should fail since we did not free all memory yet.
  ASSERT_FALSE(CRYPTO_secure_malloc_done());

  OPENSSL_secure_free(protected64);
  ASSERT_EQ(CRYPTO_secure_used(), 1024u);
  OPENSSL_secure_free(protected1000);
  ASSERT_EQ(CRYPTO_secure_used(), 0u);

  // This should ensure the heap is empty and free any resources it is holding
  // for compatibility with OpenSSL. Using it within Node.js would silently
  // disable secure heap capabilities, so don't do that.
  ASSERT_TRUE(CRYPTO_secure_malloc_done());

  // Secure memory allocation APIs should still work but use unprotected memory.
  ASSERT_FALSE(CRYPTO_secure_malloc_initialized());
  unprotected = OPENSSL_secure_malloc(1024);
  ASSERT_NE(unprotected, nullptr);
  ASSERT_FALSE(CRYPTO_secure_allocated(unprotected));
  OPENSSL_secure_free(unprotected);
}

#endif  // HAVE_OPENSSL
