export const normalizeProductInput = (input: { name: string }) => {
  return {
    ...input,
    nameLowercase: input.name.toLowerCase(),
  };
};
