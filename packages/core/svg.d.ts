declare module '*.svg' {
  import type * as React from 'react';
  import type Svg from 'react-native-svg';
  const content: React.FC<React.ComponentProps<typeof Svg>>;
  export default content;
}
