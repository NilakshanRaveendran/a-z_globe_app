/** Stands in for `expo-asset`: the bundler has already inlined the file as a data URL. */
export const Asset = {
  fromModule: (source: string | { default: string }) => ({
    uri: typeof source === "string" ? source : source.default,
  }),
};
