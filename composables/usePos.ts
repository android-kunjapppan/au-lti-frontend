export const objToVec3 = (args: { x: number; y: number; z: number }) => {
  const vec3Array = computed<[number, number, number]>(() => {
    return [args.x, args.y, args.z] as [number, number, number];
  });
  return vec3Array;
};
