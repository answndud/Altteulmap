const PUBLIC_ORIGIN = "https://altteulmap.altteul-lab.workers.dev";

function createRedirectUrl(requestUrl) {
  const source = new URL(requestUrl);
  const target = new URL(PUBLIC_ORIGIN);

  if (source.pathname === "/") {
    target.pathname = "/admin";
  } else {
    target.pathname = source.pathname;
  }

  target.search = source.search;
  target.hash = source.hash;

  return target;
}

export default {
  fetch(request) {
    return Response.redirect(createRedirectUrl(request.url).toString(), 308);
  },
};
