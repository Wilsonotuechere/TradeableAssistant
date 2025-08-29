/**
 * Utility function to perform a fetch request with a timeout
 * @param url - The URL to fetch from
 * @param options - Fetch options including timeout
 * @param timeout - Timeout in milliseconds (default: 30000)
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      throw error;
    }
    throw new Error("An unknown error occurred");
  } finally {
    clearTimeout(timeoutId);
  }
}
