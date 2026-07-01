def build_service_url(
    base_url: str | None,
    endpoint: str,
    *,
    default_base_url: str,
) -> str:
    base = (base_url or default_base_url).strip().rstrip("/")
    path = "/" + endpoint.lstrip("/")

    if base.endswith(path):
        return base

    if path.startswith("/v1/") and base.endswith("/v1"):
        return f"{base}{path[len('/v1'):]}"

    return f"{base}{path}"
