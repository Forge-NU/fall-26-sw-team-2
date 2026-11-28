// The nine text styles, in SF Pro. On iOS the system font is SF Pro, so no
// fontFamily is set: each style picks its weight. Sizes follow the iPhone's own
// text styles. Letter spacing is in points (Figma's −2% of 34pt is −0.68).
const display = { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.68 } as const;
const title = { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.22 } as const;
const headline = { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: 0 } as const;
const body = { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: 0 } as const;
const button = { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: 0 } as const;
const subhead = { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: 0 } as const;
const footnote = { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0 } as const;
const label = { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0 } as const;
const caption = { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0 } as const;

export const Typography = {
  display,
  title,
  headline,
  body,
  button,
  subhead,
  footnote,
  label,
  caption,
  // Old names, kept until the screens that use them move to the styles above
  heading: display,
  supporting: title,
  subheading: headline,
} as const;

export type TypographyVariant = keyof typeof Typography;
