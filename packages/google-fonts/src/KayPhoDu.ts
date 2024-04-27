import { loadFonts } from "./base";

export const getInfo = () => ({
   "fontFamily": "Kay Pho Du",
   "importName": "KayPhoDu",
   "version": "v2",
   "url": "https://fonts.googleapis.com/css2?family=Kay+Pho+Du:ital,wght@0,400;0,500;0,600;0,700",
   "unicodeRanges": {
      "kayah-li": "U+200C-200D, U+2010, U+25CC, U+A900-A92F",
      "latin-ext": "U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
      "latin": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
   },
   "fonts": {
      "normal": {
         "400": {
            "kayah-li": "https://fonts.gstatic.com/s/kayphodu/v2/jizfREFPvGNOx-jhPwHR0KatLQ0Z.woff2",
            "latin-ext": "https://fonts.gstatic.com/s/kayphodu/v2/jizfREFPvGNOx-jhPwHR0OCtLQ0Z.woff2",
            "latin": "https://fonts.gstatic.com/s/kayphodu/v2/jizfREFPvGNOx-jhPwHR0O6tLQ.woff2"
         },
         "500": {
            "kayah-li": "https://fonts.gstatic.com/s/kayphodu/v2/jizcREFPvGNOx-jhPwHR2B2OOHo4_goy.woff2",
            "latin-ext": "https://fonts.gstatic.com/s/kayphodu/v2/jizcREFPvGNOx-jhPwHR2B2OODw4_goy.woff2",
            "latin": "https://fonts.gstatic.com/s/kayphodu/v2/jizcREFPvGNOx-jhPwHR2B2OODI4_g.woff2"
         },
         "600": {
            "kayah-li": "https://fonts.gstatic.com/s/kayphodu/v2/jizcREFPvGNOx-jhPwHR2DGJOHo4_goy.woff2",
            "latin-ext": "https://fonts.gstatic.com/s/kayphodu/v2/jizcREFPvGNOx-jhPwHR2DGJODw4_goy.woff2",
            "latin": "https://fonts.gstatic.com/s/kayphodu/v2/jizcREFPvGNOx-jhPwHR2DGJODI4_g.woff2"
         },
         "700": {
            "kayah-li": "https://fonts.gstatic.com/s/kayphodu/v2/jizcREFPvGNOx-jhPwHR2FWIOHo4_goy.woff2",
            "latin-ext": "https://fonts.gstatic.com/s/kayphodu/v2/jizcREFPvGNOx-jhPwHR2FWIODw4_goy.woff2",
            "latin": "https://fonts.gstatic.com/s/kayphodu/v2/jizcREFPvGNOx-jhPwHR2FWIODI4_g.woff2"
         }
      }
   }
})

export const fontFamily = "Kay Pho Du" as const;

type Variants = {
  normal: {
    weights: '400' | '500' | '600' | '700',
    subsets: 'kayah-li' | 'latin' | 'latin-ext',
  },
};

export const loadFont = <T extends keyof Variants>(
  style?: T,
  options?: {
    weights?: Variants[T]['weights'][];
    subsets?: Variants[T]['subsets'][];
    document?: Document;
  }
) => { 
  return loadFonts(getInfo(), style, options);
};

