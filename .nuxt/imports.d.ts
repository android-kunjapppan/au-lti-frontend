export {
  useScriptTriggerConsent,
  useScriptEventPage,
  useScriptTriggerElement,
  useScript,
  useScriptGoogleAnalytics,
  useScriptPlausibleAnalytics,
  useScriptClarity,
  useScriptCloudflareWebAnalytics,
  useScriptFathomAnalytics,
  useScriptMatomoAnalytics,
  useScriptGoogleTagManager,
  useScriptGoogleAdsense,
  useScriptSegment,
  useScriptMetaPixel,
  useScriptXPixel,
  useScriptIntercom,
  useScriptHotjar,
  useScriptStripe,
  useScriptLemonSqueezy,
  useScriptVimeoPlayer,
  useScriptYouTubePlayer,
  useScriptGoogleMaps,
  useScriptNpm,
  useScriptCrisp,
} from "#app/composables/script-stubs";
export { isVue2, isVue3 } from "vue-demi";
export { defineNuxtLink } from "#app/components/nuxt-link";
export {
  useNuxtApp,
  tryUseNuxtApp,
  defineNuxtPlugin,
  definePayloadPlugin,
  useRuntimeConfig,
  defineAppConfig,
} from "#app/nuxt";
export {
  requestIdleCallback,
  cancelIdleCallback,
} from "#app/compat/idle-callback";
export { setInterval } from "#app/compat/interval";
export { useAppConfig, updateAppConfig } from "#app/config";
export { defineNuxtComponent } from "#app/composables/component";
export {
  useAsyncData,
  useLazyAsyncData,
  useNuxtData,
  refreshNuxtData,
  clearNuxtData,
} from "#app/composables/asyncData";
export { useHydration } from "#app/composables/hydrate";
export { callOnce } from "#app/composables/once";
export { useState, clearNuxtState } from "#app/composables/state";
export {
  clearError,
  createError,
  isNuxtError,
  showError,
  useError,
} from "#app/composables/error";
export { useFetch, useLazyFetch } from "#app/composables/fetch";
export { useCookie, refreshCookie } from "#app/composables/cookie";
export {
  onPrehydrate,
  prerenderRoutes,
  useRequestHeader,
  useRequestHeaders,
  useResponseHeader,
  useRequestEvent,
  useRequestFetch,
  setResponseStatus,
} from "#app/composables/ssr";
export { onNuxtReady } from "#app/composables/ready";
export {
  preloadComponents,
  prefetchComponents,
  preloadRouteComponents,
} from "#app/composables/preload";
export {
  abortNavigation,
  addRouteMiddleware,
  defineNuxtRouteMiddleware,
  setPageLayout,
  navigateTo,
  useRoute,
  useRouter,
} from "#app/composables/router";
export {
  isPrerendered,
  loadPayload,
  preloadPayload,
  definePayloadReducer,
  definePayloadReviver,
} from "#app/composables/payload";
export { useLoadingIndicator } from "#app/composables/loading-indicator";
export { getAppManifest, getRouteRules } from "#app/composables/manifest";
export { reloadNuxtApp } from "#app/composables/chunk";
export { useRequestURL } from "#app/composables/url";
export { usePreviewMode } from "#app/composables/preview";
export { useRouteAnnouncer } from "#app/composables/route-announcer";
export { useRuntimeHook } from "#app/composables/runtime-hook";
export { onBeforeRouteLeave, onBeforeRouteUpdate, useLink } from "vue-router";
export {
  withCtx,
  withDirectives,
  withKeys,
  withMemo,
  withModifiers,
  withScopeId,
  onActivated,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onDeactivated,
  onErrorCaptured,
  onMounted,
  onRenderTracked,
  onRenderTriggered,
  onServerPrefetch,
  onUnmounted,
  onUpdated,
  computed,
  customRef,
  isProxy,
  isReactive,
  isReadonly,
  isRef,
  markRaw,
  proxyRefs,
  reactive,
  readonly,
  ref,
  shallowReactive,
  shallowReadonly,
  shallowRef,
  toRaw,
  toRef,
  toRefs,
  triggerRef,
  unref,
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
  isShallow,
  effect,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  defineComponent,
  defineAsyncComponent,
  resolveComponent,
  getCurrentInstance,
  h,
  inject,
  hasInjectionContext,
  nextTick,
  provide,
  mergeModels,
  toValue,
  useModel,
  useAttrs,
  useCssModule,
  useCssVars,
  useSlots,
  useTransitionState,
  useId,
  useTemplateRef,
  useShadowRoot,
  Component,
  ComponentPublicInstance,
  ComputedRef,
  DirectiveBinding,
  ExtractDefaultPropTypes,
  ExtractPropTypes,
  ExtractPublicPropTypes,
  InjectionKey,
  PropType,
  Ref,
  MaybeRef,
  MaybeRefOrGetter,
  VNode,
  WritableComputedRef,
} from "vue";
export {
  injectHead,
  useHead,
  useSeoMeta,
  useHeadSafe,
  useServerHead,
  useServerSeoMeta,
  useServerHeadSafe,
} from "@unhead/vue";
export { useIsMobile } from "../composables/isMobile";
export { useAnimationManager } from "../composables/useAnimationManager";
export {
  useAudioAnalysis,
  lipSyncStatus,
} from "../composables/useAudioAnalysis";
export { useAudioRecording } from "../composables/useAudioRecording";
export { useAudioWebSocket } from "../composables/useAudioWebSocket";
export { useCanvasOAuth } from "../composables/useCanvasOAuth";
export { useContentKey } from "../composables/useContentKey";
export { useConversationManager } from "../composables/useConversationManager";
export { useCountdown } from "../composables/useCountdown";
export { useDashboardData } from "../composables/useDashboardData";
export { useEyeBlinking } from "../composables/useEyeBlinking";
export { useLBWebSocket } from "../composables/useLBWebsocket";
export { useLessonOverview } from "../composables/useLessonOverview";
export { useModelLoader } from "../composables/useModelLoader";
export { useMorphTargets } from "../composables/useMorphTargets";
export { usePermissionManager } from "../composables/usePermissionManager";
export { objToVec3 } from "../composables/usePos";
export { useSTT } from "../composables/useSTT";
export { useSTTManager } from "../composables/useSTTManager";
export { useTTSAudioManager } from "../composables/useTTSAudioManager";
export { useTweakpaneControls } from "../composables/useTweakpaneControls";
export { useWaveform } from "../composables/useWaveform";
export {
  FREQUENCY_BANDS,
  DEFAULT_AUDIO_CONFIG,
  analyzeAudioData,
  FrequencyBands,
  AudioAnalysisResult,
  AudioAnalysisConfig,
} from "../utils/audioAnalysis";
export {
  isSafari,
  isChrome,
  isFirefox,
  getBrowserInfo,
} from "../utils/browserDetection";
export {
  SupportedLang,
  CONVERSATION_ID,
  ERROR_MESSAGES,
  COMMON_ERROR_MESSAGES,
  HTTP_ERROR_MESSAGES,
  STT_ERROR_MESSAGES,
  STT_CONFIG,
  AUDIO_CONFIG,
  WAVEFORM_CONFIG,
  WEBSOCKET_CONFIG,
  AUDIO_ANALYSIS_CONFIG,
  WebSocketResponseEventType,
  WebSocketEventType,
  WebSocketTextRequestType,
  WebSocketResponseType,
  AnimationStates,
  AvatarChildMeshNames,
  facialExpressions,
  testResponseData,
  MOUTH_TARGETS,
  INTERPOLATION_SPEED,
  BLINK_DURATION,
  BLINK_PAUSE,
  EYE_MORPH_TARGETS,
  SOUND_TO_TARGETS,
  LanguageModelMapping,
  EyeMesh,
} from "../utils/constants";
export {
  formatDateTime,
  formatRelativeTime,
  isToday,
  isYesterday,
  getLatestSubmissionDate,
  getLatestSubmissionTimestamp,
} from "../utils/dateUtils";
export {
  resetDataLayer,
  bytesToBase64,
  decodeBase64Audio,
  createApiHeaders,
  BackendAudioResponse,
} from "../utils/index";
export {
  calculateTotalPracticeTime,
  calculateStudentTotalPracticeTime,
} from "../utils/timeUtils";
export { useAppStore } from "../stores/appStore";
export {
  useMessageStore,
  BotMessage,
  UserMessage,
} from "../stores/messageStore";
export { useAudioStore } from "../stores/useAudioStore";
export { useAvatarStore } from "../stores/useAvatarStore";
export { useChatbotStore } from "../stores/useChatbotStore";
export { useEnvironmentStore } from "../stores/useEnvironmentStore";
export {
  defineStore,
  acceptHMRUpdate,
  usePinia,
  storeToRefs,
} from "../node_modules/.pnpm/@pinia+nuxt@0.9.0_magicast@0.3.5_pinia@2.3.0_typescript@5.7.3_vue@3.5.13_typescript@5.7.3___rollup@4.30.1/node_modules/@pinia/nuxt/dist/runtime/composables";
export {
  useCamera,
  useLoader,
  useLogger,
  useLoop,
  useRaycaster,
  useRenderLoop,
  useRenderer,
  useSeek,
  useTexture,
  useTres,
  useTresContext,
  useTresContextProvider,
  useTresEventManager,
  extend as extendTres,
  TresObject,
} from "@tresjs/core";
export {
  extractBindingPosition,
  hasSetter,
  pick,
  useAnimations,
  useEnvironment,
  useFBO,
  useFBX,
  useGLTF,
  useGLTFExporter,
  useProgress,
  useSurfaceSampler,
  useVideoTexture,
} from "@tresjs/cientos";
export { useEffect, useEffectPmndrs } from "@tresjs/post-processing";
export { definePageMeta } from "../node_modules/.pnpm/nuxt@3.15.1_@parcel+watcher@2.5.0_@types+node@22.10.6_db0@0.2.1_eslint@9.17.0_jiti@2.4.2__ior_naijn5ddtjyoe377a4d7pnamkm/node_modules/nuxt/dist/pages/runtime/composables";
