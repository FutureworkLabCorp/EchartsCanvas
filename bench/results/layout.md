# Layout settle benchmark

Run 2026-09-18T06:48:48.585Z on node v20.19.0.

```
Layout settle — ours vs d3-force-3d (what react-force-graph-2d runs) vs d3-force
link=130 charge=-700 collide=80 gravity=0.1 alphaMin=0.001 velocityDecay=0.4
best of 3 after one warm-up. ticks and spread guard against winning by doing less.

  nodes      ours    d3-3d      d3f  ours/3d  ours/d3f  ticks o/3d/d3f  spread o/3d/d3f
  -----  --------  -------  -------  -------  --------  --------------  ---------------
    100     157ms    187ms    131ms    0.84x     1.20x     300/300/300  924/913/913
    439     818ms   1114ms   1006ms    0.73x     0.81x     300/300/300  1.9k/1.9k/1.9k
   1000    2342ms   3277ms   2588ms    0.71x     0.90x     300/300/300  2.8k/2.8k/2.8k
   2000    3420ms   7313ms   5545ms    0.47x     0.62x     300/300/300  3.9k/3.9k/3.9k
   4000    7639ms  17566ms  12730ms    0.43x     0.60x     300/300/300  5.5k/5.4k/5.4k
```
