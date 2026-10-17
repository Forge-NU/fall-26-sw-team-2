export const Typography = {
  heading: {
    fontFamily: "BarlowCondensed_600SemiBold",
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0,
  },
  supporting: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0,
  },
  subheading: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: 0,
  },
  body: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  button: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
} as const;

export type TypographyVariant = keyof typeof Typography;
