const { withAppBuildGradle } = require('@expo/config-plugins');

const CXX_RUNTIME_FLAG = '-lc++_shared';
const CMAKE_ARGUMENTS = `"-DANDROID_STL=c++_shared", "-DCMAKE_SHARED_LINKER_FLAGS=${CXX_RUNTIME_FLAG}"`;

/**
 * Keep the shared libc++ runtime on the application codegen link line.
 *
 * The React Native/Expo native dependencies already request c++_shared, but
 * the Android CMake toolchain on the supported SDK/NDK combination does not
 * propagate libc++_shared to generated application targets. This plugin adds
 * the same explicit linker input used by the native dependency patches.
 */
function withAndroidCxxRuntime(config) {
  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new Error(
        'withAndroidCxxRuntime requires the generated Android app Gradle file to use Groovy.',
      );
    }

    const contents = modConfig.modResults.contents;
    if (contents.includes(`CMAKE_SHARED_LINKER_FLAGS=${CXX_RUNTIME_FLAG}`)) {
      return modConfig;
    }

    const marker = '    defaultConfig {\n';
    if (!contents.includes(marker)) {
      throw new Error(
        'withAndroidCxxRuntime could not find the generated Android defaultConfig block.',
      );
    }

    modConfig.modResults.contents = contents.replace(
      marker,
      `${marker}        externalNativeBuild {\n          cmake {\n            arguments(${CMAKE_ARGUMENTS})\n          }\n        }\n`,
    );

    return modConfig;
  });
}

module.exports = withAndroidCxxRuntime;
