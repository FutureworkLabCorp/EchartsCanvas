# Benchmarks

`pnpm bench:layout` — settle cost of the force layout, against the two d3 engines.
Results land in `bench/results/layout.md`, committed so a later claim can cite the run
it came from.

Not part of `pnpm test`: it takes minutes and pulls dev-only dependencies.

## What it compares

| Subject | Why |
| --- | --- |
| ours | `src/core/force` |
| `d3-force-3d` | what `react-force-graph-2d` actually runs, through `force-graph` |
| `d3-force` | the 2D original, so a win over the fork is not mistaken for a win over d3 |

The third subject matters. `d3-force-3d` is generalized to N dimensions and is slower
than the 2D original at every size measured, so part of any lead over it is the cost of
that generalization rather than anything about the algorithm.

## What keeps it honest

All three get the same graph, force parameters and cooling schedule, and each runs until
alpha falls under `alphaMin` rather than for a fixed number of steps.

Two guards sit beside the timing, because a faster run is only a faster run if it did the
same work:

- **ticks** — finishing sooner by cooling in fewer steps is not a win. All three settle in
  300 ticks under these parameters.
- **spread** — a layout that converges smaller is cheaper to collide, so the widths are
  reported to show the results are comparable.

## What it does not cover

- One machine, one Node version, one synthetic graph shape. A real graph's degree
  distribution will move these numbers.
- The settle only. Rendering, hit testing and the React lifecycle are not in it; the
  demo's "성능 측정" panel covers frame cost and heap in a browser.
- Nothing here measures the shadow canvas `force-graph` keeps for hit testing, which is a
  structural difference rather than a layout one.
