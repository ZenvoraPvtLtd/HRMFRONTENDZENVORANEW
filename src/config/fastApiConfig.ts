import { getApiBaseUrl, getFrontendLoginUrl, getFrontendOrigin } from "./apiConfig";

export { getApiBaseUrl, getFrontendLoginUrl, getFrontendOrigin };

export function getFastApiBaseUrl() {
  return getApiBaseUrl();
}
