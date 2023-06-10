import { randomUUID } from 'crypto';
import * as vscode from 'vscode';

import { TwitchAuthService } from './twitchAuthService';

export const AUTH_TYPE = 'twitch';
const AUTH_NAME = 'Twitch';
const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sessions`;

export interface TwitchCredential {
  username: string;
  accessToken: string;
  scopes: string[];
}

class TwitchAuthenticationSession implements vscode.AuthenticationSession {
  readonly accessToken: string;
  readonly account: vscode.AuthenticationProviderInformation;
  readonly id: string = randomUUID();
  readonly scopes: string[] = [];
  constructor(username: string, password: string, scopes: readonly string[]) {
    this.scopes.push(...scopes);
    this.accessToken = password;
    this.account = {
      id: username,
      label: `${username}`
    };
  }
}

export class TwitchAuthenticationProvider implements vscode.AuthenticationProvider {
  public static id: string = "TwitchAuthProvider";
  private _sessions: TwitchAuthenticationSession[] = [];
  private readonly _onDidChangeSessions = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  onDidChangeSessions: vscode.Event<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent> = this._onDidChangeSessions.event;

  constructor(private readonly secrets: vscode.SecretStorage) {
    this.init();
    this.onDidChangeSessions((evt) => {
      if (evt.added && evt.added.length > 0) {

      }
      if (evt.removed && evt.removed.length > 0) {

      }
    });
  }

  async getSessions(scopes?: readonly string[] | undefined) : Promise<readonly vscode.AuthenticationSession[]> {
    const sessions = this._sessions.filter(session => scopes !== undefined ? session.scopes[0] === scopes[0] : true);
    return sessions;
  }

  async createSession(scopes: readonly string[]) : Promise<vscode.AuthenticationSession> {
    // TODO: Sign-in to Twitch API
    const s = new TwitchAuthenticationSession("", "", scopes);
    return s;
  }

  async removeSession(sessionId: string) : Promise<void> {
    const idx = this._sessions.findIndex(s => s.id === sessionId);
    const s = this._sessions[idx];
    await TwitchAuthService.revokeToken(s.accessToken);
    this._sessions.splice(idx, 1);
    this._onDidChangeSessions.fire({ added: [], removed: [s], changed: []});
    await this.saveSecrets();
  }

  async init() {
    const credentials = await this.getCredentials();
    const added: TwitchAuthenticationSession[] = [];

    if (credentials) {
      credentials?.map(credential => {
        const session = new TwitchAuthenticationSession(credential.username, credential.accessToken, credential.scopes);
        added.push(session);
      });
      this._sessions.push(...added);
      this._onDidChangeSessions.fire({ added, removed: [], changed: [] });
    }

    this.secrets.onDidChange(e => {
      if (e.key === TwitchAuthenticationProvider.id) {

        // Get the credentials from the saved store
        this.getCredentials().then(credentials => {
          const added: TwitchAuthenticationSession[] = [];
          const removed: TwitchAuthenticationSession[] = [];
          const changed: TwitchAuthenticationSession[] = [];
          const sessions = credentials?.map(credential => new TwitchAuthenticationSession(credential.username, credential.accessToken, credential.scopes));

          // Address invalidated sessions
          this._sessions.forEach(previousSession => {
            const session = sessions?.find(session => session.account.id === previousSession.account.id);
            if (session && session.accessToken !== previousSession.accessToken) {
              changed.push(previousSession);
            }
          });

          // Address removed sessions
          const sessionToRemove = this._sessions.filter(session => !sessions?.some(s => s.account.id === session.account.id));
          sessionToRemove.forEach(session => {
            const idx = this._sessions.findIndex(s => s.id === session.id);
            removed.push(...this._sessions.splice(idx, 1));
          });

          // Add new sessions
          const sessionsToAdd = sessions?.filter(session => !this._sessions.some(s => s.account.id === session.account.id));
          if (sessionsToAdd) {
            this._sessions.push(...sessionsToAdd);
            added.push(...sessionsToAdd);
          }

          this._onDidChangeSessions.fire({ added, removed, changed });
        });

      }
    });
  }

  async getCredentials(): Promise<TwitchCredential[] | undefined> {
    const credentialJSON = await this.secrets.get(TwitchAuthenticationProvider.id);
    if (credentialJSON) {
      const credentials = JSON.parse(credentialJSON) as TwitchCredential[];
      return credentials;
    }
    return undefined;
  }

  async saveSecrets() {
    const credentials: TwitchCredential[] = [];
    this._sessions.forEach(session => {
      credentials.push({
        username: session.account.id,
        accessToken: session.accessToken,
        scopes: session.scopes
      });
    });
    if (credentials.length > 0) {
      const credentialJSON = JSON.stringify(credentials);
      await this.secrets.store(TwitchAuthenticationProvider.id, credentialJSON);
    } else {
      await this.secrets.delete(TwitchAuthenticationProvider.id);
    }
  }
}