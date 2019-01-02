#include "node_secure_heap.h"
#include "util.h"

#include <fcntl.h>
#include <sys/mman.h>
#include <unistd.h>

#include <vector>
#include <algorithm>

#include <cstdio>
#include <cinttypes>

#if defined(MAP_ANON) && !defined(MAP_ANONYMOUS)
# define MAP_ANONYMOUS MAP_ANON
#endif

#define P_AS_INT(p) reinterpret_cast<uintptr_t>(p)
#define P_FROM_INT(i) reinterpret_cast<void*>(i)

namespace node {
namespace secure_heap {

static void* AllocProtectedMemory(size_t size) {
  CHECK_NE(size, 0);

  // TODO(tniessen): Add guard pages.

  // This employs several protection measures, but it isn't as secure as
  // OpenSSL's secure heap implementation. We are not using that because it
  // currently only supports a single, fixed-size heap, which isn't suited
  // for a dynamic, scripted scenario.
  void* address;

#ifdef _WIN32

  // Allocate a new set of pages. Note that Windows will automatically take care
  // of rounding the size up to the page boundary.
  address = VirtualAlloc(nullptr, size, MEM_RESERVE,
                         PAGE_READWRITE | PAGE_TARGETS_INVALID);
  if (!address)
    return nullptr;

  // This prevents the page from being written to the disk. Note that doing this
  // for a large number of pages will have a negative effect on the system
  // performance.
  // TODO: Handle errors?
  VirtualLock(address, size);
  // Make sure that the allocated memory is private to the process.
  MEMORY_BASIC_INFORMATION info;
  CHECK_NE(VirtualQuery(address, &info, size), 0);
  CHECK_EQ(info.Type, MEM_PRIVATE);

#else

# ifdef MAP_ANONYMOUS
  address = mmap(nullptr, size,
                 PROT_READ | PROT_WRITE, MAP_ANONYMOUS | MAP_PRIVATE, -1, 0);
# else
  int fd = open("/dev/zero", O_RDWR);
  if (fd >= 0) {
    address = mmap(nullptr, size, PROT_READ | PROT_WRITE, MAP_PRIVATE, fd, 0);
    close(fd);
  } else {
    address = MAP_FAILED;
  }
# endif  // MAP_ANONYMOUS

  if (address == MAP_FAILED)
    return nullptr;

  // Lock the allocated pages into memory.
  if (mlock(address, size) != 0)
    return nullptr;

# ifdef MADV_DONTDUMP
  // Prevent the pages from appearing in core dumps.
  // TODO(tniessen): Investigate whether this call is likely to fail.
  if (madvise(address, size, MADV_DONTDUMP) < 0)
    return nullptr;
# endif

#endif

  return address;
}

static size_t WidthOfSize(size_t n) {
  CHECK_NE(n, 0);

  // TODO: Implement
/*#if defined(__GNUC__)

  return (sizeof(unsigned long long) << 3) - __builtin_ffsll(n);

#elif defined(_MSC_VER)

  unsigned long result;
# if sizeof(size_t) == 4
  _BitScanReverse(&result, n);
# else
  _BitScanReverse64(&result, n);
# endif
  return result;

#else*/

  // Slow path for systems that do not support the above operations.
  for (ssize_t i = sizeof(n) * 8 - 1; i >= 0; i--) {
    if (n & (1llu << i))
      return n == (1llu << i) ? i : i + 1;
  }
  UNREACHABLE();

/*#endif*/
}

static void FreeProtectedMemory(void* ptr, size_t alloc_size) {
#ifdef _MSC_VER
  CHECK(VirtualFree(ptr, alloc_size, MEM_RELEASE));
#else
  CHECK_EQ(munmap(ptr, alloc_size), 0);
#endif
}

static inline size_t GetOffsetInUnits(const void* base, const void* ptr) {
  return (P_AS_INT(ptr) - P_AS_INT(base)) >> SECURE_HEAP_MIN_EXP;
}

BlockAddress::BlockAddress(Block* block, void* address)
      : block(block),
        address(address) {
  DCHECK_NOT_NULL(block);
  DCHECK_NOT_NULL(address);
}

BlockAddress::BlockAddress() : block(nullptr), address(nullptr) {}

BlockAddress::operator bool() const {
  return address != nullptr;
}

bool BlockAddress::operator==(const BlockAddress& addr) const {
  return block == addr.block && address == addr.address;
}

BlockAddress BlockAddress::GetBuddy(size_t exponent) {
  size_t my_offset = P_AS_INT(address) - P_AS_INT(block->base_address);
  size_t their_offset = my_offset ^ (1llu << exponent);
  void* their_addr = P_FROM_INT(P_AS_INT(block->base_address) + their_offset);
  return BlockAddress(block, their_addr);
}

BlockAddress BlockAddress::GetAddressAtNextExponent(size_t current_exponent) {
  size_t my_offset = P_AS_INT(address) - P_AS_INT(block->base_address);
  size_t buddy_offset = my_offset ^ (1llu << current_exponent);
  uintptr_t next_addr = P_AS_INT(block->base_address) +
                        (my_offset & buddy_offset);
  return BlockAddress(block, P_FROM_INT(next_addr));
}

void FreeStack::Push(const BlockAddress& addr) {
  addresses.push_back(addr);
}

bool FreeStack::Remove(const BlockAddress& addr) {
  // TODO: Check whether removal was successful
  // TODO: Is remove -> erase correct?
  auto end = std::remove(addresses.begin(), addresses.end(), addr);
  if (end == addresses.end())
    return false;
  addresses.erase(end, addresses.end());
  return true;
}

size_t FreeStack::Height() const {
  return addresses.size();
}

// Removes and returns the uppermost element from the stack.
BlockAddress FreeStack::Pop() {
  if (addresses.empty())
    return BlockAddress();
  BlockAddress address = addresses.back();
  addresses.pop_back();
  return address;
}

Block::Block(void* base_address, size_t exponent) : base_address(base_address), own_exponent(exponent) {
  CHECK_NOT_NULL(base_address);
  CHECK_GE(exponent, SECURE_HEAP_MIN_EXP);
  CHECK_LE(exponent, SECURE_HEAP_MAX_EXP);

  size_t size_in_units = (1llu << exponent) >> SECURE_HEAP_MIN_EXP;
  alloc_sizes = static_cast<size_t*>(calloc(size_in_units, sizeof(size_t)));
  CHECK(alloc_sizes);
}

void Block::SetAllocationSize(void* ptr, size_t exponent) {
  alloc_sizes[GetOffsetInUnits(base_address, ptr)] = exponent;
}

size_t Block::GetAllocationSize(void* ptr) const {
  return alloc_sizes[GetOffsetInUnits(base_address, ptr)];
}

bool Block::IsValidPointer(void* ptr) const {
  uintptr_t p = P_AS_INT(ptr);
  uintptr_t b = P_AS_INT(base_address);
  return p >= b &&
         p < b + (1llu << own_exponent) &&
         p % (1llu << SECURE_HEAP_MIN_EXP) == 0;
}

size_t Block::GetOwnExponent() const {
  return own_exponent;
}

Block::~Block() {
  free(alloc_sizes);
}

static SecureHeap* per_process_secure_heap = nullptr;
#define REQUIRE_HEAP() CHECK_NE(per_process_secure_heap, nullptr)

static int SecureHeap_done() {
  REQUIRE_HEAP();
  return per_process_secure_heap->Cleanup();
}

static void* SecureHeap_malloc(size_t sz, const char* file, int line) {
  REQUIRE_HEAP();
  return per_process_secure_heap->Alloc(sz);
}

// TODO: If we add default behavior to OpenSSL, we won't need this function.
static void* SecureHeap_zalloc(size_t sz, const char* file, int line) {
  REQUIRE_HEAP();
  // TODO
  void* mem = per_process_secure_heap->Alloc(sz);
  if (mem != nullptr)
    memset(mem, 0, sz);
  return mem;
}

static void SecureHeap_free(void* ptr, const char* file, int line) {
  REQUIRE_HEAP();
  per_process_secure_heap->Free(ptr);
}

static void SecureHeap_clear_free(void* ptr, size_t num,
                                  const char* file, int line) {
  REQUIRE_HEAP();
  per_process_secure_heap->Free(ptr);
}

static int SecureHeap_allocated(const void* ptr) {
  REQUIRE_HEAP();
  BlockAddress addr = per_process_secure_heap->GetBlockAddress(
        const_cast<void*>(ptr));
  return addr.block != nullptr;
}

static int SecureHeap_initialized() {
  REQUIRE_HEAP();
  return 1;
}

static size_t SecureHeap_actual_size(void* ptr) {
  REQUIRE_HEAP();
  BlockAddress addr = per_process_secure_heap->GetBlockAddress(ptr);
  return addr ? (1llu << addr.block->GetAllocationSize(ptr)) : 0;
}

static size_t SecureHeap_used() {
  REQUIRE_HEAP();
  return per_process_secure_heap->GetUsedMemory();
}

bool SecureHeap::ActivatePerProcess() {
  CHECK_NULL(per_process_secure_heap);
  per_process_secure_heap = this;
  return 1 == CRYPTO_set_secure_mem_functions(SecureHeap_done,
                                              SecureHeap_malloc,
                                              SecureHeap_zalloc,
                                              SecureHeap_free,
                                              SecureHeap_clear_free,
                                              SecureHeap_allocated,
                                              SecureHeap_initialized,
                                              SecureHeap_actual_size,
                                              SecureHeap_used);
}

void* SecureHeap::Alloc(size_t sz) {
  // We can safely return a nullptr since the returned pointer only needs to
  // be valid for sz bytes, which is zero in this case.
  if (sz == 0)
    return nullptr;

  size_t width = WidthOfSize(sz);
  size_t exponent = std::max(SECURE_HEAP_MIN_EXP, width);
  BlockAddress addr = AllocExponent(exponent);

  if (!addr && exponent <= SECURE_HEAP_MAX_EXP) {
    // No block was able to cover the requested amount of memory. Create a new
    // block. If that succeeds, the next call to AllocExponent must succeed as
    // well.
    if (CreateBlock(exponent) != nullptr) {
      addr = AllocExponent(exponent);
      CHECK(addr);
    }
  }

  if (addr) {
    addr.block->SetAllocationSize(addr.address, exponent);
  }

  return addr.address;
}

void SecureHeap::Free(void* ptr) {
  if (ptr == nullptr)
    return;

  CHECK(!base_addresses.empty());

  Block* block = GetBlockAddress(ptr).block;
  CHECK_NOT_NULL(block);
  CHECK(block->IsValidPointer(ptr));

  BlockAddress addr(block, ptr);
  size_t exponent = addr.block->GetAllocationSize(ptr);
  CHECK_NE(exponent, 0);

  // This is not strictly necessary, but it will make it easier to detect
  // double frees.
  addr.block->SetAllocationSize(ptr, 0);

  // Zero the contents.
  memset(ptr, 0, 1llu << exponent);

  // Try to locate the buddy of the chunk we are trying to free.
  BlockAddress buddy = addr.GetBuddy(exponent);
  while (exponent < block->own_exponent &&
         free_slices[exponent - SECURE_HEAP_MIN_EXP].Remove(buddy)) {
    // The buddy either was not used or was free'd recently, allowing us
    // to combine the two into a single memory chunk.
    addr = addr.GetAddressAtNextExponent(exponent);
    buddy = addr.GetBuddy(++exponent);
  }

  if (exponent == block->own_exponent) {
    // The whole block was free'd!
    DestroyBlock(addr.block);
  } else {
    DCHECK_LT(exponent, block->own_exponent);
    // There is no buddy, or the buddy is still being used. Either way, we
    // cannot perform any more merges.
    free_slices[exponent - SECURE_HEAP_MIN_EXP].Push(addr);
  }
}

BlockAddress SecureHeap::GetBlockAddress(void* ptr) const {
  if (!base_addresses.empty()) {
    auto upper = base_addresses.upper_bound(P_AS_INT(ptr));
    upper--;
    if (upper->second->IsValidPointer(ptr))
      return BlockAddress(upper->second, ptr);
  }

  return BlockAddress();
}

size_t SecureHeap::GetUsedMemory() const {
  // It is faster and easier to first compute the total amount of memory and
  // then subtract the unused memory than to compute the used memory directly.
  // We could also use a separate variable to keep track of used memory, but
  // this function most likely will not be called within Node.js so we don't
  // need to optimize this path at the cost of other paths.

  size_t total_mem = 0;
  for (auto const& base_address : base_addresses) {
    total_mem += 1llu << base_address.second->GetOwnExponent();
  }

  size_t unused_mem = 0;
  for (size_t exp = SECURE_HEAP_MIN_EXP; exp <= SECURE_HEAP_MAX_EXP; exp++) {
    unused_mem += free_slices[exp - SECURE_HEAP_MIN_EXP].Height() << exp;
  }

  CHECK_LE(unused_mem, total_mem);
  return total_mem - unused_mem;
}

BlockAddress SecureHeap::AllocExponent(size_t exponent) {
  if (exponent > SECURE_HEAP_MAX_EXP)
    return BlockAddress();

  BlockAddress addr = free_slices[exponent - SECURE_HEAP_MIN_EXP].Pop();
  if (!addr) {
    // Try to find a slice with twice the size, recursively.
    addr = AllocExponent(exponent + 1);
    // Split the allocated block in two to make up for the unnecessarily large
    // allocation.
    if (addr) {
      BlockAddress buddy = addr.GetBuddy(exponent);
      free_slices[exponent - SECURE_HEAP_MIN_EXP].Push(buddy);
    }
  }

  return addr;
}

static inline size_t GetPageSizeExponent() {
  size_t page_size;

#if defined(_WIN32)
  SYSTEM_INFO system_info;
  GetSystemInfo(system_info);
  page_size = system_info.dwPageSize;
#elif defined(_SC_PAGESIZE)
  page_size = sysconf(_SC_PAGESIZE);
#else
# warning "No _SC_PAGESIZE"
  page_size = getpagesize();
#endif

  // Page sizes should always be powers of two.
  size_t exponent = WidthOfSize(page_size);
  CHECK(page_size == (1llu << exponent));
  return exponent;
}

Block* SecureHeap::CreateBlock(size_t min_exponent, bool ephemeral) {
  CHECK_GE(min_exponent, SECURE_HEAP_MIN_EXP);
  CHECK_LE(min_exponent, SECURE_HEAP_MAX_EXP);

  // The page size is the smallest unit we can request from the kernel without
  // wasting resources.
  static size_t page_size_exponent = 0;
  if (page_size_exponent == 0)
    page_size_exponent = GetPageSizeExponent();

  // If the system has a small page size (<= 4096 bytes), allocate at least 16
  // pages. If the page size is larger, allocate at least 8 pages. Managing few
  // large blocks is more efficient than managing many small blocks, especially
  // when guard pages are enabled.
  size_t page_multiplier = page_size_exponent <= 12 ? 4 : 3;

  size_t desired_exponent = std::min(SECURE_HEAP_MAX_EXP,
                                     page_size_exponent + page_multiplier);
  size_t block_exponent = std::max(min_exponent, desired_exponent);

  void* base_address = AllocProtectedMemory(1llu << block_exponent);
  if (base_address != nullptr) {
    Block* block = new Block(base_address, block_exponent);
    if (block != nullptr) {
      BlockAddress base_block_addr(block, base_address);
      free_slices[block_exponent - SECURE_HEAP_MIN_EXP].Push(base_block_addr);
      base_addresses[P_AS_INT(base_address)] = block;
      return block;
    }
  }

  return nullptr;
}

void SecureHeap::DestroyBlock(Block* block) {
  CHECK_NOT_NULL(block);

  FreeProtectedMemory(block->base_address, 1llu << block->own_exponent);
  base_addresses.erase(P_AS_INT(block->base_address));
  delete block;
}

bool SecureHeap::Cleanup() {
  // This ensures that all allocations have been free'd.
  return base_addresses.empty();
}

HeapInspector::HeapInspector(const SecureHeap& heap) : heap(heap) {}

std::vector<Block*> HeapInspector::GetBlocks() const {
  std::vector<Block*> blocks;
  blocks.reserve(heap.base_addresses.size());
  for (auto val : heap.base_addresses)
    blocks.push_back(val.second);
  return blocks;
}

std::vector<BlockAddress> HeapInspector::GetFreeSlices(size_t exponent) const {
  return heap.free_slices[exponent - SECURE_HEAP_MIN_EXP].addresses;
}

}  // namespace secure_heap
}  // namespace node
