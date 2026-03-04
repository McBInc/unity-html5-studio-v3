# Stability and performance requirements

Spark icon

Page Summary

This section covers the stability and performance of Playables.

**Important:** Translated requirements are provided for reference only. Refer to the [English versions of requirements](https://developers.google.com/youtube/gaming/playables/certification/requirements?hl=en) for definitive guidance.

## 1 Initial bundle size

To properly test this requirement, the game may need to be ingested with the developer portal and then tested in the [test suite](https://developers.google.com/youtube/gaming/playables/test_suite). Alternatively hosting with compression on or zipping all of the initial loaded content can provide a good approximation.

* Game initial bundle size **MUST** be less than 30 MiB.  
* Game initial bundle size **SHOULD** be less than 15 MiB.

**Key Term:** *Initial bundle size* \- The amount of data that the Playable needs to download in order to start the game. This is measured from the start of page load to the moment the game calls [**`gameReady`](https://developers.google.com/youtube/gaming/playables/reference/sdk#gameready)**. Aim to keep the initial bundle size as small as possible to avoid long loading and to decrease the risk of users abandoning the game.**Note:** Due to the use of HTTP compression, the transfer size of game assets is sometimes less than the stored size of the assets. To learn more, visit the [FAQ](https://developers.google.com/youtube/gaming/playables/support/certification_faq#initial-bundle-size).

## 2 Total bundle size

* By default, the game total bundle size **MUST** be less than 250 MiB. Exceptions to this can be found in the [FAQ](https://developers.google.com/youtube/gaming/playables/support/certification_faq#bundle-size-exception).  
* Game **SHOULD** only load the minimal amount of data needed to enable interactivity and [lazy load](https://developer.mozilla.org/docs/Web/Performance/Lazy_loading) the other data as needed.

**Key Term:** *Total bundle size* \- The sum of all game files hosted by YouTube.

## 3 Individual file size

* Every individual file within the game **MUST** be less than 30 MiB.  
* Every individual file within the game **SHOULD** be less than 512 KiB.

**Key Term:** *Individual file size* \- The size of a single game file hosted by YouTube, such as HTML, JavaScript, WASM, or media files.

## 4 Saved game size

* Saved game size **MUST** be less than 3 MiB.  
* Saved game size **SHOULD** be less than 500 KiB.

## 5 Load time

* Game **SHOULD** finish loading and allow user interaction in under 5 seconds.

## 6 Crashes

* Game **MUST NOT** have consistently reproducible crashes.  
  * Game **MUST NOT** exceed a peak JavaScript heap size of 512 MB. See the [memory usage restrictions faq](https://developers.google.com/youtube/gaming/playables/support/faq#memory-usage-restrictions) on why this causes crashes on iPhones.  
* Game **MUST NOT** crash the YouTube app, YouTube website, or other user software.

## 7 Technologies used

* Game **MUST** be based on standards-compliant Web APIs (e.g., JavaScript, Canvas, WebGL) as defined by standards bodies (e.g., W3C, WHATWG).  
* Playables **MUST** be compatible with all browsers that YouTube supports (including Edge, Chrome, Firefox, etc.)  
* Playables **MUST** be compatible with the YouTube app on Android and iOS.

## 8 File references

* Game **MUST** only use relative paths when referring to other files in the game bundle.  
* Game **MUST NOT** use absolute paths, as they will fail to load.

## 9 File names

* Files in the game bundle **MUST** only contain alphanumeric and a few special characters: `_`, `-`, `.`.

You can use the [Playables bundle analyzer](https://developers.google.com/youtube/gaming/playables/samples/bundle_analyzer) to conduct an initial validation of the game bundle. This validation will assess the size of each individual file, the overall bundle size, and any potential filename inconsistencies.

