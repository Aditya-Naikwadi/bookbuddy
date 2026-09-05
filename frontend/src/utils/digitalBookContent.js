/**
 * Digital Book Content Engine
 * Generates structured, rich multi-chapter content for catalog & e-resource books
 * when offline, when remote EPUB binaries are unavailable, or for in-app reading.
 */

const CS_CHAPTERS = [
  {
    id: 1,
    title: "Chapter 1: Foundational Principles & Architecture",
    subtitle: "From Turing Completeness to Modern Silicon",
    readingTime: "8 min read",
    sections: [
      {
        heading: "1.1 The Mathematical Foundations of Computation",
        paragraphs: [
          "Modern computer science is rooted in the theoretical formalisms established by Alan Turing and Alonzo Church in the 1930s. At its core, computation is the systematic manipulation of symbols according to a formal set of rules. A universal Turing machine demonstrates that any algorithm computable by any physical machine can be simulated by a simple tape-based state machine.",
          "This principle underpins all general-purpose computing hardware today. Regardless of whether an instruction executes on an x86 server processor, an ARM mobile core, or a specialized tensor processing unit (TPU), the foundational limits of decidability and algorithmic complexity remain invariant.",
        ],
        callout: {
          type: "concept",
          title: "Church-Turing Thesis",
          text: "A function on the natural numbers can be calculated by an effective method if and only if it is computable by a Turing machine.",
        },
      },
      {
        heading: "1.2 The Von Neumann Architecture",
        paragraphs: [
          "In 1945, John von Neumann proposed an architectural blueprint that unified program instructions and data within the same shared address space. This architecture consists of a Central Processing Unit (CPU)—incorporating the Arithmetic Logic Unit (ALU) and registers—a Control Unit (CU), and a unified Memory Unit.",
          "The classic fetch-decode-execute cycle forms the operational heartbeat of this model. The program counter (PC) holds the memory address of the next instruction, which is fetched across the system bus, decoded into control signals, and executed by functional units.",
        ],
        codeSnippet: {
          language: "python",
          caption: "Simplified Von Neumann Instruction Cycle Simulation",
          code: `class VirtualCPU:
    def __init__(self, memory):
        self.memory = memory
        self.pc = 0
        self.registers = [0] * 8

    def cycle(self):
        # 1. Fetch
        instruction = self.memory[self.pc]
        self.pc += 1
        # 2. Decode
        opcode, r_dest, r_src = (instruction >> 8), (instruction >> 4) & 0xF, instruction & 0xF
        # 3. Execute
        if opcode == 0x1:  # ADD
            self.registers[r_dest] += self.registers[r_src]
        return instruction`,
        },
      },
      {
        heading: "1.3 The Memory Hierarchy & Latency Numbers",
        paragraphs: [
          "Due to the physical constraints of speed of light and silicon density, memory systems are organized into a strict hierarchy: CPU Registers (sub-nanosecond), L1/L2/L3 Cache (1–10 ns), Main Memory RAM (50–100 ns), and Solid-State Non-Volatile Storage (10–100 μs). Efficient software systems are engineered specifically to exploit spatial and temporal locality, maximizing cache hit ratios.",
        ],
        keyTakeaways: [
          "Computation is fundamentally bounded by the Church-Turing thesis and halting problem.",
          "The Von Neumann bottleneck describes throughput limits between CPU and unified memory.",
          "Understanding cache hierarchies is paramount for building high-throughput algorithms.",
        ],
      },
    ],
  },
  {
    id: 2,
    title: "Chapter 2: Data Structures & Algorithmic Complexity",
    subtitle: "Asymptotic Analysis, Trees, and Graph Traversal",
    readingTime: "11 min read",
    sections: [
      {
        heading: "2.1 Asymptotic Complexity and Big-O Notation",
        paragraphs: [
          "Algorithmic analysis measures computational efficiency independent of machine architecture. Big-O notation formalizes upper bounds on time and memory consumption as input size n tends toward infinity.",
          "We classify algorithms into core complexity classes: O(1) constant time lookups, O(log n) logarithmic binary searches, O(n) linear scans, O(n log n) optimal comparison sorting (MergeSort, QuickSort), and O(2^n) exponential brute-force searches.",
        ],
        callout: {
          type: "tip",
          title: "Master Theorem for Divide-and-Conquer",
          text: "T(n) = a*T(n/b) + f(n). Provides direct closed-form asymptotic bounds for recursive algorithms.",
        },
      },
      {
        heading: "2.2 Balanced Trees & Graph Traversal",
        paragraphs: [
          "While standard binary search trees degenerate to O(n) linked lists under sorted insertion, self-balancing search trees (AVL trees, Red-Black trees, B-Trees) guarantee strict O(log n) worst-case search, insertion, and deletion. In database systems, B+ Trees are ubiquitous because their high fanout minimizes expensive disk page fetches.",
          "Graphs model relationships across arbitrary networks. Depth-First Search (DFS) systematically explores branches to completion using a stack or recursion, whereas Breadth-First Search (BFS) explores level-by-level using a queue, guaranteeing shortest path discovery in unweighted graphs.",
        ],
        codeSnippet: {
          language: "javascript",
          caption: "Breadth-First Search (BFS) Shortest Path Implementation",
          code: `function bfsShortestPath(graph, startNode, targetNode) {
  const queue = [[startNode, [startNode]]];
  const visited = new Set([startNode]);

  while (queue.length > 0) {
    const [current, path] = queue.shift();
    if (current === targetNode) return path;

    for (const neighbor of (graph[current] || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, [...path, neighbor]]);
      }
    }
  }
  return null; // No path found
}`,
        },
        keyTakeaways: [
          "Select data structures based on the ratio of reads, writes, and range queries.",
          "Self-balancing trees ensure predictable logarithmic performance under adversarial input.",
          "Graph algorithms form the backbone of routing, dependency resolution, and network flow.",
        ],
      },
    ],
  },
  {
    id: 3,
    title: "Chapter 3: Operating Systems & Systems Programming",
    subtitle: "Kernel Isolation, Concurrency, and Virtual Memory",
    readingTime: "10 min read",
    sections: [
      {
        heading: "3.1 Dual-Mode Operation & System Calls",
        paragraphs: [
          "Operating systems enforce hardware isolation by leveraging CPU privilege rings: Ring 0 (Kernel Mode) with direct hardware and memory access, and Ring 3 (User Mode) running untrusted patron applications. Any privileged request—such as reading a file, spawning a thread, or transmitting a network packet—requires a hardware trap known as a System Call (syscall).",
          "Context switching between user space and kernel space incurs quantifiable overhead, including register serialization, TLB (Translation Lookaside Buffer) invalidation, and cache eviction.",
        ],
      },
      {
        heading: "3.2 Concurrency, Race Conditions, and Synchronization",
        paragraphs: [
          "Threads share the same virtual address space, enabling rapid communication but introducing race conditions when multiple threads read and write mutable state without synchronization. Mutexes, semaphores, and read-write locks enforce mutual exclusion around critical sections.",
          "Deadlock arises when four conditions coincide: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait (Coffman conditions). Modern concurrent systems mitigate this via lock-free data structures leveraging atomic Compare-And-Swap (CAS) instructions.",
        ],
        codeSnippet: {
          language: "c",
          caption: "Atomic Compare-And-Swap Spinlock Pattern",
          code: `// Atomic lock implementation using GCC atomic built-ins
typedef struct {
    volatile int lock_state;
} spinlock_t;

void acquire(spinlock_t *lock) {
    // Repeatedly attempt atomic CAS from 0 (free) to 1 (acquired)
    while (__sync_val_compare_and_swap(&lock->lock_state, 0, 1) != 0) {
        #if defined(__x86_64__)
        __builtin_ia32_pause(); // Reduce CPU pipeline contention
        #endif
    }
}

void release(spinlock_t *lock) {
    __sync_lock_release(&lock->lock_state);
}`,
        },
        keyTakeaways: [
          "Privilege rings prevent patron software from compromising operating system integrity.",
          "Always establish a global lock ordering to eliminate circular wait and deadlocks.",
          "Virtual memory pages map non-contiguous physical RAM to continuous virtual address spaces.",
        ],
      },
    ],
  },
  {
    id: 4,
    title: "Chapter 4: Computer Networks & Distributed Systems",
    subtitle: "The Internet Protocol Suite, Latency, and Consensus",
    readingTime: "9 min read",
    sections: [
      {
        heading: "4.1 The OSI Model vs. The TCP/IP Architecture",
        paragraphs: [
          "Network communication relies on strict layer abstraction. The physical and data link layers manage signal modulation and framing across ethernet or wireless spectrum. The network layer (IP) enables best-effort, packet-switched routing across interconnected autonomous systems.",
          "The transport layer provides end-to-end semantics: UDP offers connectionless, low-latency datagram transmission, while TCP guarantees in-order, lossless stream delivery via sequence acknowledgment, sliding window flow control, and congestion avoidance algorithms (e.g., Cubic, BBR).",
        ],
      },
      {
        heading: "4.2 Distributed Consensus & The CAP Theorem",
        paragraphs: [
          "Distributed systems span multiple physical nodes communicating over imperfect networks. Eric Brewer's CAP Theorem demonstrates that a distributed data store can simultaneously guarantee at most two of three properties: Consistency (all nodes see identical data simultaneously), Availability (every non-failing node returns a response), and Partition Tolerance (system functions despite dropped network packets).",
          "Consensus protocols like Raft and Paxos ensure consistency across replicated state machines by electing a leader and replicating log entries across a majority quorum.",
        ],
        callout: {
          type: "concept",
          title: "The Fallacies of Distributed Computing",
          text: "Never assume the network is reliable, latency is zero, bandwidth is infinite, or the network topology does not change.",
        },
        keyTakeaways: [
          "Network partitions are an inevitable physical reality; choose CP or AP intentionally.",
          "TCP congestion control balances throughput against bufferbloat and packet drops.",
          "Quorum consensus requires (N/2)+1 nodes to guarantee linearizable operations.",
        ],
      },
    ],
  },
  {
    id: 5,
    title: "Chapter 5: Modern Software Engineering & Cloud Architectures",
    subtitle: "Modularity, Scalability, and Clean Design Patterns",
    readingTime: "8 min read",
    sections: [
      {
        heading: "5.1 Architectural Decoupling & Microservices",
        paragraphs: [
          "As software scale expands, monolithic codebases often evolve into decoupled distributed architectures. Microservices isolate functional domains into independent deployment units communicating via asynchronous event buses (e.g., Kafka, RabbitMQ) or structured RPCs (gRPC, REST).",
          "Observability becomes paramount: structured distributed tracing (OpenTelemetry), aggregated log pipelines, and synthetic heartbeat metrics allow engineers to pinpoint bottlenecks across microsecond boundaries.",
        ],
      },
      {
        heading: "5.2 Idempotency and Fault-Tolerant Pipelines",
        paragraphs: [
          "In distributed and cloud environments, network timeouts cause message retries. Every mutating operation must be engineered to be strictly idempotent: executing the same operation multiple times with identical parameters produces the same final system state as a single execution.",
        ],
        codeSnippet: {
          language: "javascript",
          caption: "Idempotent Transaction Processing Pattern",
          code: `async function processLoanTransaction(txId, accountId, amount) {
  // 1. Check idempotency key in distributed store
  const existing = await redis.get(\`tx:\${txId}\`);
  if (existing) {
    return JSON.parse(existing); // Return recorded result safely
  }

  // 2. Perform atomic database balance mutation
  const result = await db.transaction(async (trx) => {
    return await trx.accounts.adjustBalance(accountId, amount);
  });

  // 3. Cache idempotent state with TTL
  await redis.set(\`tx:\${txId}\`, JSON.stringify(result), 'EX', 86400);
  return result;
}`,
        },
        keyTakeaways: [
          "Design microservices around business bounded contexts, not technical layers.",
          "Idempotency keys eliminate catastrophic duplicate charges or duplicate checkout mutations.",
          "Embrace automated testing and CI/CD canary deployments to ensure production resilience.",
        ],
      },
    ],
  },
];

const GENERIC_CHAPTERS = (title, category, author) => [
  {
    id: 1,
    title: `Chapter 1: Introduction to ${title}`,
    subtitle: `Foundations, Scope, and Historical Context`,
    readingTime: "7 min read",
    sections: [
      {
        heading: "1.1 Overview and Academic Context",
        paragraphs: [
          `"${title}" represents a cornerstone work within the field of ${category || "scholarly research"}. authored by ${author || "esteemed researchers"}, this volume provides a rigorous and systematic investigation into foundational concepts and contemporary practices.`,
          "Understanding the fundamental tenets of this discipline requires exploring the historical evolution of its core hypotheses, evaluating foundational frameworks, and analyzing empirical methodologies developed over decades of research.",
        ],
        callout: {
          type: "info",
          title: "Key Scholarly Theme",
          text: `The core thesis of this work emphasizes systematic analysis, reproducible methodologies, and critical evaluation of ${category || "academic principles"}.`,
        },
      },
      {
        heading: "1.2 Theoretical Foundations",
        paragraphs: [
          "Theoretical constructs serve as the lens through which observed phenomena are structured and tested. In this chapter, we outline the foundational assumptions, the governing terminology, and the diagnostic models that guide modern scholarship in this discipline.",
        ],
        keyTakeaways: [
          "Clear definitions and scoped boundary conditions are essential for valid inquiry.",
          "Historical paradigms inform and constrain current methodological frameworks.",
          "Synthesis of cross-disciplinary concepts provides novel analytical depth.",
        ],
      },
    ],
  },
  {
    id: 2,
    title: "Chapter 2: Methodologies, Frameworks & Case Studies",
    subtitle: "Systematic Implementation and Practical Exploration",
    readingTime: "9 min read",
    sections: [
      {
        heading: "2.1 Framework Evaluation",
        paragraphs: [
          "Practical application demands robust analytical frameworks that can withstand real-world variability and data noise. When testing theoretical models against practical observations, systematic controls and double-blind validation standards must be rigorously enforced.",
          "Through a series of comprehensive case studies, this chapter demonstrates the translation of abstract theory into structured, repeatable operational workflows.",
        ],
      },
      {
        heading: "2.2 Comparative Analysis",
        paragraphs: [
          "By analyzing comparative data sets across distinct temporal and environmental contexts, researchers can isolate governing variables from incidental noise, establishing dependable predictive models.",
        ],
        keyTakeaways: [
          "Empirical verification remains the bedrock of rigorous academic study.",
          "Case study analysis bridges the gap between theoretical models and real-world results.",
        ],
      },
    ],
  },
  {
    id: 3,
    title: "Chapter 3: Advanced Applications & Future Perspectives",
    subtitle: "Emerging Paradigms, Synthesis, and Conclusion",
    readingTime: "8 min read",
    sections: [
      {
        heading: "3.1 Emerging Paradigms and Cross-Domain Synthesis",
        paragraphs: [
          `As ${category || "this field"} continues to mature, interdisciplinary integration with modern computational analysis, quantitative heuristics, and collaborative open-access scholarship is accelerating discovery.`,
          "Scholars and practitioners alike must navigate the balance between time-tested canonical principles and novel speculative techniques.",
        ],
      },
      {
        heading: "3.2 Summary & Comprehensive Review",
        paragraphs: [
          `In conclusion, "${title}" offers an indispensable roadmap for students, researchers, and professionals striving for mastery. Continued critical engagement with these topics will drive sustained advancement across the academic landscape.`,
        ],
        keyTakeaways: [
          "Continuous re-evaluation of assumptions is required as new evidence emerges.",
          "Interdisciplinary synthesis generates the highest-impact breakthroughs.",
        ],
      },
    ],
  },
];

/**
 * Returns structured chapters for any book or resource title
 */
export const getStructuredBookChapters = (bookOrTitle) => {
  const target =
    typeof bookOrTitle === "string"
      ? { title: bookOrTitle }
      : bookOrTitle || {};
  const title = target.title || target.name || "Digital Edition";
  const author = target.author || "Academic Faculty";
  const category = target.category || target.genre || "";

  const titleLower = title.toLowerCase();
  const categoryLower = category.toLowerCase();

  const isComputerScience =
    titleLower.includes("computer science") ||
    titleLower.includes("algorithm") ||
    titleLower.includes("programming") ||
    titleLower.includes("software") ||
    titleLower.includes("data structure") ||
    titleLower.includes("operating system") ||
    categoryLower.includes("computer science") ||
    categoryLower.includes("technology") ||
    categoryLower.includes("engineering");

  if (isComputerScience) {
    return CS_CHAPTERS;
  }

  return GENERIC_CHAPTERS(title, category, author);
};

export default getStructuredBookChapters;
