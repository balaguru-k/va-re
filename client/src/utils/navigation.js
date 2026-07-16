export const navigateWithParams = (navigate, path, params = {}) => {
  let finalPath = path;
  Object.entries(params).forEach(([key, value]) => {
    finalPath = finalPath.replace(`{${key}}`, value);
  });
  navigate(finalPath);
};