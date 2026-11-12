export const isSpaConfigValid = (options: { ssr: boolean; prerender: boolean }) => {
  return options.ssr === false && options.prerender === false;
};
