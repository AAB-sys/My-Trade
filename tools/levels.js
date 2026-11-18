// One set of numbers (18 November): the levels are the CHART's (static/volprofile.js, 24 rows), the shape the chart's shape rule
// (static/vpshape.js). R(bars, W) = VpShape.read's answer with poc, vah, val replaced by the chart's.
"use strict";
const S = require("path").resolve(__dirname, ".."), V = require(S + "/swingtree/static/vpshape.js");
const VPm = require(S + "/swingtree/static/volprofile.js"), VP = VPm && VPm.build ? VPm : globalThis.VolProfile;
function R(bars, W) { const q = V.read(bars, W); if (!q) return q; const have = W && [...W.values()].some(v => v > 0), p = VP.build(bars, have ? W : null); return { ...q, poc: p.poc, vah: p.vah, val: p.val }; }
module.exports = { R, V, VP };
