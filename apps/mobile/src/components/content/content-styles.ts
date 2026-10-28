import { StyleSheet } from "react-native";
import { Palette, Radii, Spacing } from "@/constants/theme";
import { ContentTokens } from "@/constants/content-tokens";

export const contentStyles = StyleSheet.create({
  cardHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  cardAuthor: { flex: 1, minWidth: 0 },
  card: {
    width: "100%",
    maxWidth: ContentTokens.maxCardWidth,
    alignSelf: "center",
    backgroundColor: Palette.white,
    borderRadius: Radii.pill,
    borderColor: Palette.peach,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  copy: { gap: Spacing.one },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.peach,
    paddingTop: Spacing.two,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  preview: {
    width: "100%",
    maxWidth: ContentTokens.maxCardWidth,
    alignSelf: "center",
    gap: Spacing.three,
  },
});
