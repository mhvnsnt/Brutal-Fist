export async function createClient() {
  const { createClient: browser } = await import("./client");
  return browser();
}
