#ifndef SRC_NODE_SECURE_HEAP_H_
#define SRC_NODE_SECURE_HEAP_H_

#if defined(NODE_WANT_INTERNALS) && NODE_WANT_INTERNALS

#include <openssl/crypto.h>

#include <cstdlib>
#include <map>
#include <vector>

// The minimum exponent. Every allocation allocates at least 2**MIN_EXPONENT
// bytes, even if the requested number of bytes is much smaller. All allocations
// are thus multiples of this "unit".
#define SECURE_HEAP_MIN_EXP (size_t { 8u })

// The maximum exponent. 2**MAX_EXPONENT is the maximum number of contiguous
// bytes a user can allocate. This should be reasonably close to MIN_EXPONENT
// since the complexity of the allocator operations increases with the
// difference between the exponents.
#define SECURE_HEAP_MAX_EXP (size_t { 20u })


namespace node {
namespace secure_heap {

class Block;
class SecureHeap;
struct BlockAddress {
  BlockAddress(Block* block, void* address);
  BlockAddress();

  operator bool() const;

  bool operator==(const BlockAddress& addr) const;

  BlockAddress GetBuddy(size_t exponent);
  BlockAddress GetAddressAtNextExponent(size_t current_exp);

  Block* block;
  void* address;
};

class FreeStack {
 public:
  FreeStack() = default;
  FreeStack(const FreeStack& copy) = delete;
  FreeStack& operator=(const FreeStack& copy) = delete;

  // Pushes an address onto the stack to be used (or merged) later.
  void Push(const BlockAddress& addr);

  // Removes an address from the stack.
  bool Remove(const BlockAddress& addr);

  // Removes and returns the uppermost element from the stack.
  BlockAddress Pop();

  size_t Height() const;

 private:
  std::vector<BlockAddress> addresses;

  friend class HeapInspector;
};

class Block {
 public:
  // Creates a new block based on previously allocated memory.
  Block(void* base_address, size_t exponent, bool ephemeral);

  // Stores the size of an allocation within this block.
  void SetAllocationSize(void* ptr, size_t exponent);
  // Retrieves the size of an allocation within this block.
  size_t GetAllocationSize(void* ptr) const;

  // Returns true iff the given pointer is within this block's bounds and its
  // offset within the block is a multiple of 2**SECURE_HEAP_MIN_EXP.
  bool IsValidPointer(void* ptr) const;

  size_t GetOwnExponent() const;

  ~Block();

 private:
  void* base_address;
  size_t own_exponent;
  size_t* alloc_sizes;
  bool ephemeral;

  friend class BlockAddress;
  friend class SecureHeap;
};

class HeapInspector;
class SecureHeap {
 public:
  SecureHeap() = default;

  bool ActivatePerProcess();

  bool CreateNonEphemeralBlock(size_t min_exponent);

  void* Alloc(size_t sz);
  void Free(void* ptr);

  BlockAddress GetBlockAddress(void* addr) const;
  size_t GetUsedMemory() const;

  bool Cleanup();

 private:
  BlockAddress AllocExponent(size_t exponent);

  Block* CreateBlock(size_t min_exponent, bool ephemeral);
  void DestroyBlock(Block* block);

  FreeStack free_slices[SECURE_HEAP_MAX_EXP - SECURE_HEAP_MIN_EXP + 1];
  std::map<uintptr_t, Block*> base_addresses;

  friend class HeapInspector;
};

class HeapInspector {
 public:
  explicit HeapInspector(const SecureHeap& heap);

  std::vector<Block*> GetBlocks() const;
  std::vector<BlockAddress> GetFreeSlices(size_t exponent) const;

 private:
  const SecureHeap& heap;
};

}  // namespace secure_heap
}  // namespace node

#endif  // defined(NODE_WANT_INTERNALS) && NODE_WANT_INTERNALS

#endif  // SRC_NODE_SECURE_HEAP_H_
