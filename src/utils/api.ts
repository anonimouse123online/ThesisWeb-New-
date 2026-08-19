/**
 * Wrapper around fetch() that automatically includes the JWT token
 * from localStorage in the Authorization header.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken");

  console.log("[AUTH] Request:", url);
  console.log("[AUTH] Token found:", !!token);

  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  } else {
    console.warn(
      "[AUTH] No JWT token found in localStorage."
    );
  }

  // Add JSON content type only when necessary
  if (
    options.body &&
    !(typeof FormData !== "undefined" &&
      options.body instanceof FormData)
  ) {
    if (!headers.has("Content-Type")) {
      headers.set(
        "Content-Type",
        "application/json"
      );
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  console.log(
    "[AUTH] Response:",
    response.status,
    url
  );

  if (
    response.status === 401 ||
    (
      response.status === 404 &&
      url.includes("/auth/me")
    )
  ) {

    console.warn(
      "[AUTH] Session invalid or expired."
    );

    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");

    // Prevent redirect loop if already on login page
    if (
      window.location.pathname !== "/login"
    ) {
      window.location.href = "/login";
    }

    throw new Error(
      "Session expired or user not found. Please log in again."
    );
  }

  return response;
}