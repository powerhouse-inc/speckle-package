import { publicOriginFrom } from "./lib.js";

export const getResolvers = (): Record<string, unknown> => {
  return {
    Query: {
      // Read on every request, so a changed environment needs no code path of
      // its own. Never add SPECKLE_TOKEN or SPECKLE_INTERNAL_ORIGIN here.
      speckleServer: () => ({
        publicOrigin: publicOriginFrom(process.env.SPECKLE_PUBLIC_ORIGIN),
      }),
    },
  };
};
