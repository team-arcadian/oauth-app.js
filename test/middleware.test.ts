import { createServer } from "http";
import { URL } from "url";

import fetch from "node-fetch";
import fetchMock from "fetch-mock";
import { OAuthAppOctokit } from "../src/oauth-app-octokit";

import { OAuthApp } from "../src";

describe("app.middleware", () => {
  it("GET /api/github/oauth/octokit.js", async () => {
    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret"
    });

    const server = createServer(app.middleware).listen();
    // @ts-ignore complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/octokit.js`
    );

    server.close();

    expect(await response.text()).toMatch(/Core.defaults/);
  });

  it("GET /api/github/oauth/login", async () => {
    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret"
    });

    const server = createServer(app.middleware).listen();
    // @ts-ignore complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const { status, headers } = await fetch(
      `http://localhost:${port}/api/github/oauth/login`,
      {
        redirect: "manual"
      }
    );

    server.close();

    expect(status).toEqual(302);

    const url = new URL(headers.get("location") as string);
    expect(url).toMatchObject({
      origin: "https://github.com",
      pathname: "/login/oauth/authorize"
    });
    expect(url.searchParams.get("client_id")).toEqual("0123");
    expect(url.searchParams.get("state")).toMatch(/^\w+$/);
    expect(url.searchParams.get("scope")).toEqual(null);
  });

  it("GET /api/github/oauth/login?state=mystate123&scopes=one,two,three", async () => {
    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret"
    });

    const server = createServer(app.middleware).listen();
    // @ts-ignore complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const { status, headers } = await fetch(
      `http://localhost:${port}/api/github/oauth/login?state=mystate123&scopes=one,two,three`,
      {
        redirect: "manual"
      }
    );

    server.close();

    expect(status).toEqual(302);

    const url = new URL(headers.get("location") as string);
    expect(url).toMatchObject({
      origin: "https://github.com",
      pathname: "/login/oauth/authorize"
    });

    expect(url.searchParams.get("client_id")).toEqual("0123");
    expect(url.searchParams.get("state")).toEqual("mystate123");
    expect(url.searchParams.get("scope")).toEqual("one,two,three");
  });

  it("GET /api/github/oauth/callback?code=012345&state=mystate123", async () => {
    const mock = fetchMock
      .sandbox()
      .postOnce(
        "https://github.com/login/oauth/access_token",
        {
          access_token: "token123",
          scope: "",
          token_type: "bearer"
        },
        {
          body: {
            client_id: "0123",
            client_secret: "0123secret",
            code: "012345",
            state: "state123"
          }
        }
      )
      .getOnce(
        "https://api.github.com/user",
        { login: "octocat" },
        {
          headers: {
            authorization: "token token123"
          }
        }
      );

    const Mocktokit = OAuthAppOctokit.defaults({
      request: {
        fetch: mock
      }
    });

    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
      Octokit: Mocktokit
    });

    const onTokenCallback = jest.fn();
    app.on("token.created", onTokenCallback);

    const server = createServer(app.middleware).listen();
    // @ts-ignore complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/callback?code=012345&state=state123`
    );

    server.close();

    expect(response.status).toEqual(200);
    expect(onTokenCallback.mock.calls.length).toEqual(1);
    const [context] = onTokenCallback.mock.calls[0];

    expect(context).toMatchObject({
      token: "token123",
      scopes: []
    });
    expect(context.octokit).toBeInstanceOf(Mocktokit);

    const { data } = await context.octokit.request("GET /user");
    expect(data.login).toEqual("octocat");
  });

  it("POST /api/github/oauth/token", async () => {
    const mock = fetchMock.sandbox().postOnce(
      "https://github.com/login/oauth/access_token",
      {
        access_token: "token123",
        scope: "",
        token_type: "bearer"
      },
      {
        body: {
          client_id: "0123",
          client_secret: "0123secret",
          code: "012345",
          state: "state123"
        }
      }
    );

    const Mocktokit = OAuthAppOctokit.defaults({
      request: {
        fetch: mock
      }
    });

    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
      Octokit: Mocktokit
    });

    const onTokenCallback = jest.fn();
    app.on("token.created", onTokenCallback);

    const server = createServer(app.middleware).listen();
    // @ts-ignore complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        method: "POST",
        body: JSON.stringify({
          code: "012345",
          state: "state123"
        })
      }
    );

    server.close();

    expect(response.status).toEqual(201);
    expect(onTokenCallback.mock.calls.length).toEqual(1);
    const [context] = onTokenCallback.mock.calls[0];

    expect(context).toMatchObject({
      token: "token123",
      scopes: []
    });
  });

  it("GET /api/github/oauth/token", async () => {
    const mock = fetchMock.sandbox().postOnce(
      "https://api.github.com/applications/0123/token",
      { id: 1 },
      {
        headers: {
          authorization:
            "basic " + Buffer.from("0123:0123secret").toString("base64")
        },
        body: {
          access_token: "token123"
        }
      }
    );

    const Mocktokit = OAuthAppOctokit.defaults({
      request: {
        fetch: mock
      }
    });

    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
      Octokit: Mocktokit
    });

    const server = createServer(app.middleware).listen();
    // @ts-ignore complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        headers: {
          authorization: "token token123"
        }
      }
    );

    server.close();

    expect(response.status).toEqual(200);
    expect(await response.json()).toStrictEqual({ id: 1 });
  });

  it("PATCH /api/github/oauth/token", async () => {
    const mock = fetchMock.sandbox().patchOnce(
      "https://api.github.com/applications/0123/token",
      {
        id: 2,
        token: "token456",
        scopes: ["repo"]
      },
      {
        headers: {
          authorization:
            "basic " + Buffer.from("0123:0123secret").toString("base64")
        },
        body: {
          access_token: "token123"
        }
      }
    );

    const Mocktokit = OAuthAppOctokit.defaults({
      request: {
        fetch: mock
      }
    });

    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
      Octokit: Mocktokit
    });

    const onTokenCallback = jest.fn();
    app.on("token.reset", onTokenCallback);

    const server = createServer(app.middleware).listen();
    // @ts-ignore complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        method: "PATCH",
        headers: {
          authorization: "token token123"
        }
      }
    );

    server.close();

    expect(response.status).toEqual(200);
    expect(await response.json()).toStrictEqual({
      id: 2,
      token: "token456",
      scopes: ["repo"]
    });

    expect(onTokenCallback.mock.calls.length).toEqual(1);
    const [context] = onTokenCallback.mock.calls[0];

    expect(context).toMatchObject({
      name: "token",
      action: "reset",
      token: "token456",
      scopes: ["repo"]
    });
  });
  it("DELETE /api/github/oauth/token", async () => {
    const mock = fetchMock
      .sandbox()
      .deleteOnce("https://api.github.com/applications/0123/token", 204, {
        headers: {
          authorization:
            "basic " + Buffer.from("0123:0123secret").toString("base64")
        },
        body: {
          access_token: "token123"
        }
      });

    const Mocktokit = OAuthAppOctokit.defaults({
      request: {
        fetch: mock
      }
    });

    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
      Octokit: Mocktokit
    });

    const onTokenCallback = jest.fn();
    app.on(["token.before_deleted", "token.deleted"], onTokenCallback);

    const server = createServer(app.middleware).listen();
    // @ts-ignore complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        method: "DELETE",
        headers: {
          authorization: "token token123"
        }
      }
    );

    server.close();

    expect(response.status).toEqual(204);

    expect(onTokenCallback.mock.calls.length).toEqual(2);
    const [context_before_deleted] = onTokenCallback.mock.calls[0];
    const [context_deleted] = onTokenCallback.mock.calls[1];

    expect(context_before_deleted).toMatchObject({
      name: "token",
      action: "before_deleted",
      token: "token123"
    });
    expect(context_before_deleted.octokit).toBeInstanceOf(Mocktokit);

    expect(context_deleted).toStrictEqual({
      name: "token",
      action: "deleted",
      token: "token123"
    });
  });
});
