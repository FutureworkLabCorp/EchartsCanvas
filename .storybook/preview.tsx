import React from 'react';
import type { Decorator, Preview } from '@storybook/react';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { industrialDark, industrialLight } from '../src/theme/presets';
import '../src/styles/base.css';

const withTheme: Decorator = (Story, context) => {
  const themeName = context.globals['theme'] as string;
  const theme = themeName === 'light' ? industrialLight : industrialDark;

  return (
    <ThemeProvider theme={theme}>
      <div
        style={{
          background: theme.palette.background,
          color: theme.palette.textPrimary,
          padding: 16,
          minHeight: '100vh',
          fontFamily: theme.font.family,
        }}
      >
        <Story />
      </div>
    </ThemeProvider>
  );
};

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    backgrounds: { disable: true },
  },
  globalTypes: {
    theme: {
      description: '시각화 테마',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'dark', title: 'Industrial Dark' },
          { value: 'light', title: 'Industrial Light' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
};

export default preview;
