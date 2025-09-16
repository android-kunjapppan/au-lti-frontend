import { defineStore } from "pinia";
export const useEnvironmentStore = defineStore("environment", () => {
  const environmentMap = shallowRef("/environmentMaps/default_map.hdr");

  const updateEnvironmentMap = (newMap: string) => {
    environmentMap.value = newMap;
  };
  const restoreDefaultEnvironmentMap = () => {
    // rogland_clear_night_1k.hdr from https://polyhaven.com/a/rogland_clear_night
    environmentMap.value = "/environmentMaps/default_map.hdr";
  };

  return {
    environmentMap,
    updateEnvironmentMap,
    restoreDefaultEnvironmentMap,
  };
});
