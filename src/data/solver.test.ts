import { describe, expect, it } from 'vitest'
import { solveSteinerTree } from './solver'
import type { ProcessedNode } from '@/types/skill-tree'

/** Helper to build a bidirectional adjacency map from edge pairs */
function buildAdj(edges: [string, string][]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  const ensure = (id: string) => {
    if (!adj.has(id)) adj.set(id, new Set())
  }
  for (const [a, b] of edges) {
    ensure(a)
    ensure(b)
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }
  return adj
}

describe('solveSteinerTree', () => {
  it('simple chain: start → A → B → C, require C', () => {
    const adj = buildAdj([
      ['S', 'A'],
      ['A', 'B'],
      ['B', 'C'],
    ])
    const result = solveSteinerTree(
      'S',
      new Set(['C']),
      new Set(),
      adj,
      new Set(['S']),
    )
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.cost).toBe(3) // A, B, C
      expect(result.nodes).toContain('S')
      expect(result.nodes).toContain('A')
      expect(result.nodes).toContain('B')
      expect(result.nodes).toContain('C')
    }
  })

  it('Y-shaped tree: shared stem, two branches', () => {
    //     S
    //     |
    //     1
    //    / \
    //   2   3
    //   |   |
    //   A   B
    const adj = buildAdj([
      ['S', '1'],
      ['1', '2'],
      ['1', '3'],
      ['2', 'A'],
      ['3', 'B'],
    ])
    const result = solveSteinerTree(
      'S',
      new Set(['A', 'B']),
      new Set(),
      adj,
      new Set(['S']),
    )
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      // Optimal: S-1-2-A + 1-3-B = 5 new nodes (1,2,A,3,B)
      expect(result.cost).toBe(5)
    }
  })

  it('diamond graph: should pick shorter path', () => {
    //   S
    //  / \
    // A   B
    //  \ /
    //   C
    //   |
    //   D (required)
    const adj = buildAdj([
      ['S', 'A'],
      ['S', 'B'],
      ['A', 'C'],
      ['B', 'C'],
      ['C', 'D'],
    ])
    const result = solveSteinerTree(
      'S',
      new Set(['D']),
      new Set(),
      adj,
      new Set(['S']),
    )
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      // Optimal: S → A/B → C → D = 3 new nodes
      expect(result.cost).toBe(3)
      expect(result.nodes.size).toBe(4) // S + 3 new
    }
  })

  it('parallel paths: should share common segments', () => {
    // This models the PoE issue: two required nodes where paths
    // should share a common trunk but Dijkstra may pick divergent paths.
    //
    //   S - 1 - 2 - 3 - A (required)
    //           |
    //           4 - 5 - B (required)
    //
    // Optimal: S-1-2-3-A + 2-4-5-B = 7 nodes total, cost 7
    const adj = buildAdj([
      ['S', '1'],
      ['1', '2'],
      ['2', '3'],
      ['3', 'A'],
      ['2', '4'],
      ['4', '5'],
      ['5', 'B'],
    ])
    const result = solveSteinerTree(
      'S',
      new Set(['A', 'B']),
      new Set(),
      adj,
      new Set(['S']),
    )
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.cost).toBe(7) // 1,2,3,A,4,5,B
      expect(result.nodes).toContain('2') // shared junction
    }
  })

  it('should not detour through longer paths when short paths share a junction', () => {
    // This models the key failure case:
    //
    //   S - 1 - 2 - 3 - A (required)
    //       |       |
    //       6       7
    //       |       |
    //       5 - 4 - 8 - B (required)
    //
    // Direct paths:
    //   S→A: S-1-2-3-A (cost 4)
    //   S→B: S-1-6-5-4-8-B (cost 6) or S-1-2-3-7-8-B (cost 6)
    //   A→B: A-3-7-8-B (cost 4) or A-3-2-1-6-5-4-8-B (cost 8)
    //
    // MST should pick S→A (4) + A→B (4) = total 8, giving nodes:
    //   S,1,2,3,A,7,8,B → cost 7
    //
    // NOT S→A (4) + S→B (6) = total 10, giving:
    //   S,1,2,3,A,6,5,4,8,B → cost 9
    const adj = buildAdj([
      ['S', '1'],
      ['1', '2'],
      ['2', '3'],
      ['3', 'A'],
      ['1', '6'],
      ['6', '5'],
      ['5', '4'],
      ['4', '8'],
      ['3', '7'],
      ['7', '8'],
      ['8', 'B'],
    ])
    const result = solveSteinerTree(
      'S',
      new Set(['A', 'B']),
      new Set(),
      adj,
      new Set(['S']),
    )
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      // Optimal: S-1-2-3-A + 3-7-8-B = {S,1,2,3,A,7,8,B} = cost 7
      expect(result.cost).toBeLessThanOrEqual(7)
      // It should NOT include the detour through 6,5,4
      expect(result.nodes.has('6')).toBe(false)
      expect(result.nodes.has('5')).toBe(false)
    }
  })

  it('blocked nodes force detour', () => {
    //   S - 1 - 2 - A (required)
    //       |
    //       3 - 4 - A (alternate)
    //
    // Block node 2 → must go S-1-3-4-A
    const adj = buildAdj([
      ['S', '1'],
      ['1', '2'],
      ['2', 'A'],
      ['1', '3'],
      ['3', '4'],
      ['4', 'A'],
    ])
    const result = solveSteinerTree(
      'S',
      new Set(['A']),
      new Set(['2']),
      adj,
      new Set(['S']),
    )
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.cost).toBe(4) // 1,3,4,A
      expect(result.nodes.has('2')).toBe(false)
    }
  })

  it('three required nodes with shared trunk should minimize total cost', () => {
    // Models the PoE scenario: start in center, required nodes spread out
    //
    //          S
    //          |
    //          1
    //         /|\
    //        2  3  4
    //        |  |  |
    //        A  B  C   (all required)
    //
    // Optimal: S-1 + 1-2-A + 1-3-B + 1-4-C = cost 7
    const adj = buildAdj([
      ['S', '1'],
      ['1', '2'],
      ['1', '3'],
      ['1', '4'],
      ['2', 'A'],
      ['3', 'B'],
      ['4', 'C'],
    ])
    const result = solveSteinerTree(
      'S',
      new Set(['A', 'B', 'C']),
      new Set(),
      adj,
      new Set(['S']),
    )
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.cost).toBe(7) // 1,2,A,3,B,4,C
    }
  })

  it('MST should prefer path overlap when it reduces total node count', () => {
    // This is the critical test for the PoE bug.
    // Two required nodes where MST picks edges that produce non-overlapping
    // paths, but overlapping paths would use fewer total nodes.
    //
    //   S - a - b - c - d - R1 (required)
    //               |
    //               e - f - R2 (required)
    //
    // Also, there's an alternative path from S to R2:
    //   S - x - y - z - R2
    //
    // Dijkstra S→R1: S-a-b-c-d-R1 (cost 5)
    // Dijkstra S→R2 via trunk: S-a-b-c-e-f-R2 (cost 6)
    // Dijkstra S→R2 via alt: S-x-y-z-R2 (cost 4) ← shorter!
    // Dijkstra R1→R2: R1-d-c-e-f-R2 (cost 4)
    //
    // MST options:
    //   S→R1 (5) + S→R2 (4) = total weight 9
    //     Nodes: {S,a,b,c,d,R1} + {S,x,y,z,R2} = 10 distinct, cost 10
    //   S→R1 (5) + R1→R2 (4) = total weight 9
    //     Nodes: {S,a,b,c,d,R1} + {R1,d,c,e,f,R2} = {S,a,b,c,d,R1,e,f,R2} = 8 distinct, cost 8
    //   S→R2 (4) + R2→R1 (4) = total weight 8
    //     Nodes: {S,x,y,z,R2} + {R2,f,e,c,d,R1} = {S,x,y,z,R2,f,e,c,d,R1} = 10 distinct, cost 10
    //
    // MST should pick S→R2 (4) + R2→R1 (4) = weight 8 (smaller!)
    // But this gives 10 nodes! The S→R1 (5) + R1→R2 (4) = weight 9 gives only 8 nodes.
    //
    // This demonstrates the MST approximation flaw: it minimizes total edge
    // weight (Dijkstra distances), NOT total node count. When paths overlap,
    // edge weights don't capture the savings from shared nodes.
    const adj = buildAdj([
      ['S', 'a'],
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
      ['d', 'R1'],
      ['c', 'e'],
      ['e', 'f'],
      ['f', 'R2'],
      ['S', 'x'],
      ['x', 'y'],
      ['y', 'z'],
      ['z', 'R2'],
    ])
    const result = solveSteinerTree(
      'S',
      new Set(['R1', 'R2']),
      new Set(),
      adj,
      new Set(['S']),
    )
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      console.log('MST overlap test result:', {
        cost: result.cost,
        nodes: [...result.nodes],
      })
      // The OPTIMAL solution uses 8 nodes: S,a,b,c,d,R1,e,f,R2 (cost 8)
      // The MST may pick the worse 10-node solution
      // This test documents the expected behavior — if it fails, the MST is suboptimal
      expect(result.cost).toBeLessThanOrEqual(8)
    }
  })

  it('already-allocated nodes reduce path cost', () => {
    //   S - 1 - 2 - 3 - A (required)
    //                 where 1 and 2 are already allocated
    const adj = buildAdj([
      ['S', '1'],
      ['1', '2'],
      ['2', '3'],
      ['3', 'A'],
    ])
    const result = solveSteinerTree(
      'S',
      new Set(['A']),
      new Set(),
      adj,
      new Set(['S', '1', '2']), // S, 1, 2 already allocated
    )
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      // Only 3 and A are new
      expect(result.cost).toBe(2)
    }
  })

  it('unreachable required node returns error', () => {
    const adj = buildAdj([
      ['S', 'A'],
      ['B', 'C'], // B,C disconnected from S
    ])
    const result = solveSteinerTree(
      'S',
      new Set(['C']),
      new Set(),
      adj,
      new Set(['S']),
    )
    expect('error' in result).toBe(true)
  })

  it('preferNotables: chooses path through notable when two equal-cost paths exist', () => {
    // Two paths from S to T, both 3 hops:
    //   S - A - B - T  (A is notable)
    //   S - X - Y - T  (all normal)
    //
    // Without preferNotables: either path is fine (cost 3)
    // With preferNotables: should prefer S-A-B-T because A is notable (lower weight)
    const adj = buildAdj([
      ['S', 'A'],
      ['A', 'B'],
      ['B', 'T'],
      ['S', 'X'],
      ['X', 'Y'],
      ['Y', 'T'],
    ])

    const processedNodes = new Map<string, ProcessedNode>()
    for (const id of ['S', 'A', 'B', 'T', 'X', 'Y']) {
      processedNodes.set(id, {
        id,
        node: { name: id } as ProcessedNode['node'],
        worldX: 0,
        worldY: 0,
        type: id === 'A' ? 'notable' : 'normal',
        spriteCoords: null as unknown as ProcessedNode['spriteCoords'],
        radius: 10,
      })
    }

    const result = solveSteinerTree(
      'S',
      new Set(['T']),
      new Set(),
      adj,
      new Set(['S']),
      processedNodes,
      true,
    )
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.cost).toBe(3)
      // Should go through the notable node A
      expect(result.nodes.has('A')).toBe(true)
      expect(result.nodes.has('B')).toBe(true)
      // Should NOT go through X, Y
      expect(result.nodes.has('X')).toBe(false)
      expect(result.nodes.has('Y')).toBe(false)
    }
  })

  it('preferNotables: does not increase cost to reach notables', () => {
    // Notable is on a longer path — should still pick the shorter path
    //   S - A - T       (2 hops, all normal)
    //   S - X - Y - T   (3 hops, X is notable)
    //
    // Even with preferNotables, the 2-hop path should win
    const adj = buildAdj([
      ['S', 'A'],
      ['A', 'T'],
      ['S', 'X'],
      ['X', 'Y'],
      ['Y', 'T'],
    ])

    const processedNodes = new Map<string, ProcessedNode>()
    for (const id of ['S', 'A', 'T', 'X', 'Y']) {
      processedNodes.set(id, {
        id,
        node: { name: id } as ProcessedNode['node'],
        worldX: 0,
        worldY: 0,
        type: id === 'X' ? 'notable' : 'normal',
        spriteCoords: null as unknown as ProcessedNode['spriteCoords'],
        radius: 10,
      })
    }

    const result = solveSteinerTree(
      'S',
      new Set(['T']),
      new Set(),
      adj,
      new Set(['S']),
      processedNodes,
      true,
    )
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.cost).toBe(2)
    }
  })

  it('performance: handles larger graph with many terminals', () => {
    // Build a grid-like graph: 50x50 = 2500 nodes
    const edges: [string, string][] = []
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        const id = `${x}_${y}`
        if (x < 49) edges.push([id, `${x + 1}_${y}`])
        if (y < 49) edges.push([id, `${x}_${y + 1}`])
      }
    }
    const adj = buildAdj(edges)

    // 10 required nodes spread across the grid
    const required = new Set([
      '5_5', '45_5', '25_25', '5_45', '45_45',
      '10_20', '40_20', '25_10', '25_40', '30_30',
    ])

    const start = performance.now()
    const result = solveSteinerTree(
      '0_0',
      required,
      new Set(),
      adj,
      new Set(['0_0']),
    )
    const elapsed = performance.now() - start

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      // All required nodes should be in the result
      for (const r of required) {
        expect(result.nodes.has(r)).toBe(true)
      }
      // Should complete in reasonable time (< 1 second)
      expect(elapsed).toBeLessThan(1000)
      console.log(`Grid solver: ${result.cost} points in ${elapsed.toFixed(0)}ms`)
    }
  })
})
