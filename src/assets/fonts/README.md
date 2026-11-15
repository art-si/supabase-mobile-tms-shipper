# TMS Sans SC

`tms-sans-sc.woff2` is a subset of Google's Noto Sans SC variable font. The source is `ofl/notosanssc/NotoSansSC[wght].ttf` in the Google Fonts repository (source SHA-256: `A3041811A78C361B1DE50F953C805E0244951C21C5BD412F7232EF0D899AF0DA`). Its SIL Open Font License is bundled at `src/static/fonts/NotoSansSC-OFL.txt`.

The subset contains 2,900 frequently used Han characters selected from Unicode Unihan `kHanyuPinlu`, additional place and license-plate characters used in this app, every Han character currently present in `src`, basic Latin, and app punctuation. The included variable weight range is 400–700. Characters outside the subset fall back to the device font.

To update the subset, download that source TTF and run `node scripts/build-ui-font-css.mjs <path-to-source-ttf>`. To rebuild only the embedded CSS after changing the WOFF2, run `pnpm font:css`. Both H5 and WeChat mini program embed the same WOFF2 data; the mini program's local `@font-face` path did not load in the developer tool.
