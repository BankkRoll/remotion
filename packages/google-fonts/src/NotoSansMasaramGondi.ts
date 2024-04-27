import { loadFonts } from "./base";

export const getInfo = () => ({
   "fontFamily": "Noto Sans Masaram Gondi",
   "importName": "NotoSansMasaramGondi",
   "version": "v17",
   "url": "https://fonts.googleapis.com/css2?family=Noto+Sans+Masaram+Gondi:ital,wght@0,400",
   "unicodeRanges": {
      "masaram-gondi": "U+0964-0965, U+200C-200D, U+25CC, U+11D00-11D5F",
      "latin-ext": "U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
      "latin": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
   },
   "fonts": {
      "normal": {
         "400": {
            "masaram-gondi": "https://fonts.gstatic.com/s/notosansmasaramgondi/v17/6xK_dThFKcWIu4bpRBjRYRV7KZCbUq6n_1kPntH65xMNWQ.woff2",
            "latin-ext": "https://fonts.gstatic.com/s/notosansmasaramgondi/v17/6xK_dThFKcWIu4bpRBjRYRV7KZCbUq6n_1kPntGX5xMNWQ.woff2",
            "latin": "https://fonts.gstatic.com/s/notosansmasaramgondi/v17/6xK_dThFKcWIu4bpRBjRYRV7KZCbUq6n_1kPntGZ5xM.woff2"
         }
      }
   }
})

export const fontFamily = "Noto Sans Masaram Gondi" as const;

type Variants = {
  normal: {
    weights: '400',
    subsets: 'latin' | 'latin-ext' | 'masaram-gondi',
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

