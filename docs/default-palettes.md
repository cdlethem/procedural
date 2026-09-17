# Default palettes

Fifty ready-to-use palettes combine deep neutrals, pale grounds, subdued earth colors, saturated accents and limited tonal ranges. Each has four to six ordered colors. Names describe the colors: **Copper Patina**, **Cobalt Chalk**, **Ink & Saffron**, **Seafoam Sand** and **Rust & Storm**, for example.

Preview the local swatches: [palettes 1–25](../.work/external-art-research/default-palette-swatches-0.png) and [palettes 26–50](../.work/external-art-research/default-palette-swatches-1.png).

In the web app, open **Palettes**, or open the palette picker from a gallery study, Studio layer or prompt. Search by name or color tags, apply a default directly, or choose **Customize** to start an editable copy. Saving that copy adds it to your own library. Defaults remain available when the saved-palette service is unavailable and are never automatically inserted into storage.

In a p5.js sketch, import the library and select a palette by stable ID:

```js
import { defaultPalettes } from '@procedurals/javascript';

const palette = defaultPalettes.find(p => p.id === 'copper-patina');
const colors = [...palette.colors];

// Inside your p5 drawing function:
p.background(colors[0]);
p.fill(colors[2]);
p.circle(160, 160, 120);
```

For a source checkout, the equivalent import is `packages/javascript/src/default-palettes.js` relative to your sketch. The module has no p5 or network dependency. It exports a frozen array of frozen `{id, name, colors, description, tags}` records. Copy `colors` before changing their values or order. Hex colors work directly with p5; existing numeric operations can use `colors.map(hex => parseInt(hex.slice(1), 16))`.

Color order is intentional, but positions have no universal meaning. A sketch may treat the first color as its ground, or use every color for marks. Try reordering or changing color proportions: equal-width swatches cannot predict the balance of a densely layered composition. These are artwork palettes, with no text-contrast or accessibility rating.

The colors were sampled and then curated from the [reference corpus](external-art-corpus.md). They are inspired color choices, not exact reconstructions of an artist’s working palette. Source attribution, image hashes, extracted candidates and explicit adjustments live in [curation evidence](../evidence/external-art/2026-09/default-palette-curation.json), outside the product names. The [canonical module](../packages/javascript/src/default-palettes.js) is the reusable library; [root review](../evidence/external-art/2026-09/default-palette-review.json) records validation and visual scope.

## Palette index

| Name | Stable ID | Ordered colors | Character |
|---|---|---|---|
| Deep Teal | `deep-teal` | `#011111` `#023131` `#046666` `#057676` `#aedad3` | Deep teal shades with a pale sea-glass accent. |
| Cobalt Chalk | `cobalt-chalk` | `#0000fe` `#5555ea` `#9797f0` `#f3f3fb` | Electric cobalt softened by periwinkle and chalk. |
| Citron Olive | `citron-olive` | `#51572b` `#929641` `#bfaf3b` `#f4e245` `#f2efa9` | Sharp citron, dry olive and pale lemon. |
| Fern & Mauve | `fern-mauve` | `#535294` `#5b998d` `#8dc896` `#c5809b` `#ad9774` `#e9e1d5` | Muted fern, mauve and violet with warm linen. |
| Slate Pearl | `slate-pearl` | `#36465d` `#56626d` `#b6c2b8` `#ece9d5` | Blue slate, soft green-gray and creamy pearl. |
| Mauve Mist | `mauve-mist` | `#544a60` `#76697a` `#b3a4ae` `#d3c4c9` `#ebdadb` | Quiet mauve shades fading into pink mist. |
| Ochre Plum | `ochre-plum` | `#5c3345` `#842b4b` `#485e63` `#c56137` `#d9852f` | Deep plum, smoky teal and burnt ochre. |
| Sage Linen | `sage-linen` | `#485334` `#7f8e56` `#9dac75` `#b8c78d` `#e8ebd5` | Soft sage and leafy olive against pale linen. |
| Orchid Chalk | `orchid-chalk` | `#793862` `#dd7bc7` `#eaace1` `#efd2ed` `#f0f0f0` | Orchid pink, petal lavender and white chalk. |
| Apricot Iris | `apricot-iris` | `#794f85` `#5b5bdb` `#6f6cd3` `#d9835d` `#cc9d94` | Warm apricot set against vivid iris and dusty rose. |
| Seafoam Lilac | `seafoam-lilac` | `#617c9a` `#9496d2` `#7fcec4` `#a1e0a7` `#d1e3c6` | Seafoam, lilac and pale green with a blue-gray anchor. |
| Cyan Frost | `cyan-frost` | `#00758c` `#01ccf5` `#3cd4f0` `#b8f3fc` `#ffffff` | Clear cyan with icy blue tints and white. |
| Emerald Lime | `emerald-lime` | `#18533e` `#329370` `#57d273` `#b8dd94` `#dcf599` `#ffffff` | Emerald and fresh green brightened by pale lime. |
| Honey Cream | `honey-cream` | `#97701d` `#ba9630` `#e0a726` `#f6bd27` `#f0d588` `#fff0ca` | Golden honey, toasted ochre and soft cream. |
| Rose Citrus | `rose-citrus` | `#8e55a0` `#d964c0` `#ed98ce` `#47a3ac` `#d8e16f` `#e39977` | Violet, bright rose, citrus yellow and cool turquoise. |
| Electric Citrus | `electric-citrus` | `#f90eb7` `#ff457e` `#ff8a42` `#fec508` `#4ee170` | Hot pink, coral, tangerine, yellow and electric green. |
| Wine Ash | `wine-ash` | `#311224` `#5c1222` `#7a1320` `#7f7273` `#bdb4b4` | Blackened plum and wine reds lifted by warm ash. |
| Lemon Garnet | `lemon-garnet` | `#201e18` `#7a3045` `#95bda9` `#dcf4a5` `#feffa3` `#feffd7` | Pale lemon and soft mint with garnet and dark charcoal. |
| Olive Bone | `olive-bone` | `#605e37` `#8e994e` `#acc641` `#c9d29f` `#dddfc9` `#f3f3f0` | Dry olive, yellow-green and bone white. |
| Plum Fern | `plum-fern` | `#432b52` `#614258` `#825172` `#506c66` `#9da58d` | Smoky plum and muted fern with a soft sage accent. |
| Crimson Chalk | `crimson-chalk` | `#b00000` `#c35050` `#dfb0b0` `#f6f6f6` | Deep crimson fading through dusty rose to chalk. |
| Jade Frost | `jade-frost` | `#053f4e` `#085562` `#168a8b` `#3ca6a1` `#dfeeed` `#ffffff` | Dark blue-green, jade and luminous frost. |
| Dusty Rose Sage | `dusty-rose-sage` | `#884c4f` `#9f6063` `#c38f91` `#909084` `#b8c0a3` | Weathered rose, warm gray and pale sage. |
| Ultramarine Lilac | `ultramarine-lilac` | `#070c39` `#2c3289` `#3048b9` `#7875ce` `#958ed3` | Deep ultramarine with cool violet and lilac. |
| Copper Blush | `copper-blush` | `#38271f` `#70483c` `#926f69` `#d5a5ab` `#e7d2d3` `#faf4f8` | Copper brown, rose metal and pale blush. |
| Copper Patina | `copper-patina` | `#553b21` `#89602e` `#81704c` `#56786c` `#52897f` `#b5b5a0` | Burnished copper, mossy teal and pale stone. |
| Ink & Ivory | `ink-ivory` | `#23282d` `#585c5f` `#bebdbc` `#e0ddda` `#f3efec` | Cool ink, soft graphite and warm ivory. |
| Cobalt Night | `cobalt-night` | `#000000` `#153052` `#294e84` `#3a7ad4` `#3b9bd9` | Black and midnight blue struck with bright cobalt. |
| Plum Moss | `plum-moss` | `#030602` `#0c170a` `#370737` `#520949` `#7b0e3f` `#b1497f` | Near-black moss, deep plum and a berry accent. |
| Prussian Cream | `prussian-cream` | `#061117` `#082f4a` `#1d4361` `#657373` `#bdbda8` `#e9e7d8` | Prussian blue and smoky gray against aged cream. |
| Blue Linen | `blue-linen` | `#195ca8` `#5b87b8` `#a2b5ca` `#c6ccd3` `#f5ebdf` | Denim blue, powder blue and warm linen. |
| Rose Velvet | `rose-velvet` | `#160007` `#450017` `#7e022e` `#bf2c5f` `#d26189` `#edbccd` | Black cherry, rich rose and soft pink velvet. |
| Ink & Saffron | `ink-saffron` | `#281a23` `#8f4042` `#ab715f` `#c4b187` `#e3d9b5` `#d69a36` | Warm ink, brick red, toasted gold and cream. |
| Cyan Magenta | `cyan-magenta` | `#00396a` `#005b8f` `#00b1ed` `#00fdff` `#670e49` `#a80767` | Electric cyan and vivid magenta over deep blue. |
| Marigold Rose | `marigold-rose` | `#d7664a` `#db5a83` `#dba65c` `#daad67` `#e1c599` | Soft marigold, warm coral and rose pink. |
| Ochre Meadow | `ochre-meadow` | `#937051` `#76946d` `#8b9a64` `#bfaf52` `#f19826` `#f4c443` | Meadow green and dry ochre brightened by amber. |
| Mist & Gold | `mist-gold` | `#a3e2e9` `#cae9dd` `#ccdbb9` `#e1bc68` `#f9f7db` `#ffffff` | Airy cyan, pale sage and soft golden cream. |
| Coral Slate | `coral-slate` | `#7f838a` `#8d555b` `#bc6062` `#e68177` `#e9bb9f` | Warm coral and dusty rose balanced by cool slate. |
| Acid Mint | `acid-mint` | `#0d0c0d` `#283632` `#486951` `#30eeb4` `#dcf517` | Acid yellow and bright mint against green-black. |
| Moss Chalk | `moss-chalk` | `#0c0c0c` `#576847` `#739b54` `#c4cbad` `#fefefa` | Black ink, leafy moss and chalk white. |
| Frost Slate | `frost-slate` | `#1f212c` `#455170` `#9da5c2` `#b7c6e8` `#dadef4` `#fefcff` | Deep slate, icy blue-gray and frosted white. |
| Aqua Ivory | `aqua-ivory` | `#0e040b` `#569a82` `#2fc59a` `#5df0dc` `#c9fef1` `#f6fef6` | Clear aqua and sea-green with dark ink and ivory. |
| Gold Umber | `gold-umber` | `#0f0505` `#2c1c08` `#402b0b` `#654910` `#b89539` | Blackened umber with a restrained antique-gold glow. |
| Jade Violet | `jade-violet` | `#05016d` `#260277` `#1f416e` `#458277` `#92c477` | Deep violet, blue-green and fresh jade. |
| Pearl Wine | `pearl-wine` | `#41292f` `#68575e` `#8e8786` `#a4a197` `#d6d5d1` | Muted wine shadows, warm stone and pearl gray. |
| Glacier Mist | `glacier-mist` | `#677f8b` `#88a5aa` `#b1cdcb` `#d5e7e3` `#faf8f4` | Soft blue-gray and pale glacier green fading into cream. |
| Cherry Cobalt | `cherry-cobalt` | `#021c69` `#461e62` `#a42254` `#ec254c` `#f3303e` | Dark cobalt and plum set against sharp cherry red. |
| Rose Slate | `rose-slate` | `#2f3763` `#455d83` `#6f7998` `#b77d9b` `#d69bae` `#dddbd5` | Blue slate and dusty rose with soft stone white. |
| Seafoam Sand | `seafoam-sand` | `#5d948e` `#53aaac` `#6abeb0` `#bda08c` `#dfcea5` `#f3eadb` | Seafoam and quiet turquoise with sandy cream. |
| Rust & Storm | `rust-storm` | `#3d4256` `#567383` `#68989f` `#9b5c4a` `#ad7754` `#aca899` | Storm blue, muted teal and weathered rust. |
