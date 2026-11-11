import { useSignIn, useSignUp } from '@clerk/expo';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemedText } from '@/components/themed-text';
import { Palette, Typography } from '@/constants/theme';

type AuthMode = 'sign-in' | 'sign-up';
// form: identifier + password. verify: a code to confirm a new account or a
// new device. forgot: identifier for a reset. reset: reset code + new password.
type Step = 'form' | 'verify' | 'forgot' | 'reset';

const MIN_PASSWORD_LENGTH = 8; // Clerk's default minimum

// Clerk API errors carry a readable longMessage per problem; prefer that over
// the generic top-level message.
function clerkErrorMessage(cause: unknown, fallback: string) {
  const errors = (cause as { errors?: { longMessage?: string; message?: string }[] })?.errors;
  const first = errors?.[0];
  if (first) return first.longMessage ?? first.message ?? fallback;
  return cause instanceof Error ? cause.message : fallback;
}

export default function AuthScreen() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [step, setStep] = useState<Step>('form');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (cause) {
      setError(clerkErrorMessage(cause, fallback));
    } finally {
      setBusy(false);
    }
  };

  const goTo = (next: Step) => {
    setStep(next);
    setCode('');
    setError(null);
    setNotice(null);
  };

  // A password sign-in from a new device can need an email code (Clerk's
  // device trust). Any other incomplete status is unexpected for this app.
  // Email only: phone/SMS needs a paid Clerk plan.
  const continueSignIn = async () => {
    if (signIn.status === 'complete') {
      const finalized = await signIn.finalize();
      if (finalized.error) throw finalized.error;
      return;
    }
    if (signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') {
      const factors = signIn.supportedSecondFactors.map((factor) => factor.strategy);
      if (!factors.includes('email_code')) {
        throw new Error('This account needs a verification method the app does not support yet.');
      }
      const sent = await signIn.mfa.sendEmailCode();
      if (sent.error) throw sent.error;
      goTo('verify');
      return;
    }
    throw new Error('The sign-in still needs another step.');
  };

  const submitForm = () =>
    run(async () => {
      if (mode === 'sign-up') {
        const created = await signUp.create({ emailAddress: identifier.trim(), password });
        if (created.error) throw created.error;
        const sent = await signUp.verifications.sendEmailCode();
        if (sent.error) throw sent.error;
        goTo('verify');
      } else {
        const result = await signIn.password({ identifier: identifier.trim(), password });
        if (result.error) throw result.error;
        await continueSignIn();
      }
    }, mode === 'sign-up' ? 'We could not create your account.' : 'We could not sign you in.');

  const verifyCode = () =>
    run(async () => {
      if (mode === 'sign-up') {
        const result = await signUp.verifications.verifyEmailCode({ code: code.trim() });
        if (result.error) throw result.error;
        if (signUp.status === 'missing_requirements') {
          // The app collects an email and a password. If the Clerk
          // instance requires more (e.g. a name), turn that off under
          // User & authentication in the Clerk Dashboard.
          throw new Error(`Clerk also requires: ${signUp.missingFields.join(', ')}. Turn these off in the Clerk Dashboard (User & authentication).`);
        }
        if (signUp.status !== 'complete') throw new Error('The account still needs a verification step.');
        const finalized = await signUp.finalize();
        if (finalized.error) throw finalized.error;
      } else {
        const result = await signIn.mfa.verifyEmailCode({ code: code.trim() });
        if (result.error) throw result.error;
        await continueSignIn();
      }
    }, 'That code could not be verified.');

  const resendCode = () =>
    run(async () => {
      const sent = step === 'reset'
        ? await signIn.resetPasswordEmailCode.sendCode()
        : mode === 'sign-up'
          ? await signUp.verifications.sendEmailCode()
          : await signIn.mfa.sendEmailCode();
      if (sent.error) throw sent.error;
      setNotice('A new code is on its way.');
    }, 'We could not resend your code.');

  const sendResetCode = () =>
    run(async () => {
      const created = await signIn.create({ identifier: identifier.trim() });
      if (created.error) throw created.error;
      const sent = await signIn.resetPasswordEmailCode.sendCode();
      if (sent.error) throw sent.error;
      setPassword('');
      goTo('reset');
    }, 'We could not send a reset code.');

  const resetPassword = () =>
    run(async () => {
      const verified = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
      if (verified.error) throw verified.error;
      const submitted = await signIn.resetPasswordEmailCode.submitPassword({ password });
      if (submitted.error) throw submitted.error;
      await continueSignIn();
    }, 'We could not reset your password.');

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setPassword('');
    goTo('form');
  };

  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;
  const formReady = !!identifier.trim() && (mode === 'sign-in' ? password.length > 0 : passwordValid);
  const codeReady = code.trim().length === 6;
  const subtitle = {
    form: 'Your next story starts here',
    verify: 'Check your messages',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  }[step];

  return (
    <SafeAreaView style={styles.screen}>
      {/* Tapping outside a field closes the keyboard; the number pad has no done key. */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>Yuji</ThemedText>
        <ThemedText type="subtitle" style={styles.subtitle}>{subtitle}</ThemedText>

        {step === 'form' && (
          <>
            <View style={styles.switchRow}>
              <ModeChoice selected={mode === 'sign-in'} label="Sign in" onPress={() => switchMode('sign-in')} />
              <ModeChoice selected={mode === 'sign-up'} label="Create account" onPress={() => switchMode('sign-up')} />
            </View>
            {mode === 'sign-up' ? (
              <Input
                label="Email address"
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="you@example.com"
              />
            ) : (
              <Input
                label="Email or username"
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
              />
            )}
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              textContentType={mode === 'sign-up' ? 'newPassword' : 'password'}
              hint={mode === 'sign-up' && !passwordValid ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
            />
            {error && <ThemedText style={styles.error}>{error}</ThemedText>}
            <Button
              title={mode === 'sign-up' ? 'Create account' : 'Sign in'}
              onPress={submitForm}
              loading={busy}
              disabled={!formReady}
              filled={formReady}
            />
            {mode === 'sign-in' && (
              <Pressable onPress={() => goTo('forgot')} style={styles.link}>
                <ThemedText type="linkPrimary">Forgot password?</ThemedText>
              </Pressable>
            )}
          </>
        )}

        {step === 'verify' && (
          <>
            <ThemedText style={styles.hint}>
              {mode === 'sign-up' ? `We sent a code to ${identifier.trim()}.` : 'New device: we sent a code to your email.'}
            </ThemedText>
            <Input label="Verification code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} />
            {error && <ThemedText style={styles.error}>{error}</ThemedText>}
            {notice && <ThemedText style={styles.hint}>{notice}</ThemedText>}
            <Button title="Verify and continue" onPress={verifyCode} loading={busy} disabled={!code.trim()} filled={codeReady} />
            <Pressable onPress={resendCode} disabled={busy} style={styles.link}>
              <ThemedText type="linkPrimary">Resend code</ThemedText>
            </Pressable>
            <Pressable onPress={() => goTo('form')} style={styles.link}>
              <ThemedText type="linkPrimary">Back</ThemedText>
            </Pressable>
          </>
        )}

        {step === 'forgot' && (
          <>
            <Input
              label="Email address"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
            />
            {error && <ThemedText style={styles.error}>{error}</ThemedText>}
            <Button title="Send reset code" onPress={sendResetCode} loading={busy} disabled={!identifier.trim()} filled={!!identifier.trim()} />
            <Pressable onPress={() => goTo('form')} style={styles.link}>
              <ThemedText type="linkPrimary">Back to sign in</ThemedText>
            </Pressable>
          </>
        )}

        {step === 'reset' && (
          <>
            <ThemedText style={styles.hint}>We sent a reset code to your email.</ThemedText>
            <Input label="Reset code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} />
            <Input
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              hint={!passwordValid ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
            />
            {error && <ThemedText style={styles.error}>{error}</ThemedText>}
            {notice && <ThemedText style={styles.hint}>{notice}</ThemedText>}
            <Button title="Reset password" onPress={resetPassword} loading={busy} disabled={!codeReady || !passwordValid} filled={codeReady && passwordValid} />
            <Pressable onPress={resendCode} disabled={busy} style={styles.link}>
              <ThemedText type="linkPrimary">Resend code</ThemedText>
            </Pressable>
            <Pressable onPress={() => goTo('form')} style={styles.link}>
              <ThemedText type="linkPrimary">Back to sign in</ThemedText>
            </Pressable>
          </>
        )}
      </View>
      </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

function ModeChoice({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><ThemedText style={selected ? styles.choiceTextSelected : styles.choiceText}>{label}</ThemedText></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Palette.warmWhite, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 460, alignSelf: 'center', padding: 28, gap: 18 },
  title: { color: Palette.coral, textAlign: 'center', fontSize: 40 },
  subtitle: { textAlign: 'center', color: Palette.black },
  switchRow: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: Palette.lightPink },
  choiceSelected: { backgroundColor: Palette.lightPink, borderColor: Palette.coral },
  choiceText: { ...Typography.label, color: Palette.black },
  choiceTextSelected: { ...Typography.label, color: Palette.coral },
  hint: { textAlign: 'center', color: Palette.black },
  error: { textAlign: 'center', color: Palette.coral },
  link: { alignSelf: 'center' },
});
