/** Browser geolocation + OpenStreetMap reverse geocode (no API key). */

export async function fetchCurrentPlace() {
  if (!navigator.geolocation) {
    throw new Error("Location is not supported in this browser.");
  }

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 60000
    });
  });

  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  let label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" }
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.display_name) label = data.display_name;
      const city =
        data?.address?.city ||
        data?.address?.town ||
        data?.address?.suburb ||
        data?.address?.county;
      const area = data?.address?.neighbourhood || data?.address?.suburb || data?.address?.road;
      return { lat, lng, label, area, city };
    }
  } catch {
    /* use coordinates label */
  }

  return { lat, lng, label, area: "", city: "" };
}
