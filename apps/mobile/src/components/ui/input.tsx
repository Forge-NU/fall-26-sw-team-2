import { useState, type Ref } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { InputTokens } from '@/constants/input-tokens';
import { Spacing } from '@/constants/theme';

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  disabled?: boolean;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  // 'bare' drops the box (border, background, padding) for text typed over
  // media, like the story composer's photo. Style the text with `style`.
  variant?: 'default' | 'bare';
  /** For focusing the field, e.g. when tapping Reply */
  ref?: Ref<TextInputInstance>;
};

export function Input({
  label,
  error,
  hint,
  containerStyle,
  disabled = false,
  editable = true,
  style,
  onFocus,
  onBlur,
  accessibilityLabel,
  accessibilityState,
  placeholderTextColor = InputTokens.placeholder,
  variant = 'default',
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const isDisabled = disabled || !editable;

  const borderColor = error
    ? InputTokens.errorBorder
    : focused && !isDisabled
      ? InputTokens.focusedBorder
      : InputTokens.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View testID="app-input-field" style={[
        styles.field,
        { borderColor, borderWidth: focused && !isDisabled ? InputTokens.focusedBorderWidth : InputTokens.borderWidth,
          backgroundColor: isDisabled ? InputTokens.disabledBackground : InputTokens.background },
        isDisabled && styles.disabled,
        variant === 'bare' && styles.bareField,
      ]}>
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
        editable={!isDisabled}
        placeholderTextColor={placeholderTextColor}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          Platform.OS === 'web' && styles.webInput,
          variant === 'bare' && styles.bareInput,
          style,
        ]}
      />
      </View>

      {error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: InputTokens.gap,
  },
  label: {
    ...InputTokens.labelTypography,
    color: InputTokens.text,
    textAlign: 'center',
  },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    borderRadius: InputTokens.borderRadius,
    paddingHorizontal: InputTokens.paddingHorizontal,
  },
  input: {
    ...InputTokens.typography,
    minHeight: InputTokens.minHeight,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: InputTokens.paddingVertical,
    color: InputTokens.text,
  },
  disabled: {
    opacity: InputTokens.disabledOpacity,
  },
  webInput: { outlineWidth: 0 },
  bareField: { borderWidth: 0, paddingHorizontal: 0, backgroundColor: 'transparent' },
  bareInput: { minHeight: 0, paddingVertical: 0 },
  error: {
    ...InputTokens.typography,
    color: InputTokens.errorBorder,
  },
  hint: {
    ...InputTokens.typography,
    color: InputTokens.text,
  },
});
