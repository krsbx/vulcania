export const Library = {
  SDL3: "SDL3",
  SDL3Image: "SDL3_image",
  SDL3Mixer: "SDL3_mixer",
  SDL3Ttf: "SDL3_ttf",
  SDL3Shadercross: "SDL_shadercross",
} as const;

export type Library = (typeof Library)[keyof typeof Library];

export const Platform = {
  Windows: "windows",
  Linux: "linux",
  MacOS: "macos",
} as const;

export type Platform = (typeof Platform)[keyof typeof Platform];

export const LibraryExtension = {
  Windows: ".dll",
  Linux: ".so",
  MacOS: ".dylib",
} as const;

export type LibraryExtension =
  (typeof LibraryExtension)[keyof typeof LibraryExtension];

export const LibraryPathResolution = {
  Windows: "lib",
  Linux: "lib",
  MacOS: "../Resources/lib",
} as const;

export type LibraryPathResolution =
  (typeof LibraryPathResolution)[keyof typeof LibraryPathResolution];
