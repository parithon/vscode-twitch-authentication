import { randomUUID } from 'crypto';
import * as vscode from 'vscode';

export const AUTH_TYPE = 'twitch';
const AUTH_NAME = 'Twitch';
const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sessions`;

export class TwitchAuthenticationProvider implements vscode.AuthenticationProvider, vscode.Disposable {
  private _sessionChangeEmitter = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
  private _disposable: vscode.Disposable;

  constructor(private readonly context: vscode.ExtensionContext) {
    this._disposable = vscode.Disposable.from(
      vscode.authentication.registerAuthenticationProvider(AUTH_TYPE, AUTH_NAME, this, { supportsMultipleAccounts: false })
    );
  }

  get onDidChangeSessions() {
    return this._sessionChangeEmitter.event;
  }

  /**
   * Get the existing sessions
   * @param scopes 
   * @returns 
   */
   public async getSessions(scopes?: string[]): Promise<readonly vscode.AuthenticationSession[]> {
    return [];
  }

  /**
   * Create a new auth session
   * @param scopes 
   * @returns 
   */
  public async createSession(scopes: string[]): Promise<vscode.AuthenticationSession> {
    try {
      const token = await this.login(scopes);
      if (!token) {
        throw new Error(`Twitch login failure`);
      }

      const userinfo: { name: string, email: string } = await this.getUserInfo(token);

      const session: vscode.AuthenticationSession = {
        id: randomUUID(),
        accessToken: token,
        account: {
          label: userinfo.name,
          id: userinfo.email
        },
        scopes: []
      };

      await this.context.secrets.store(SESSIONS_SECRET_KEY, JSON.stringify([session]));

      this._sessionChangeEmitter.fire({ added: [session], removed: [], changed: [] });

      return session;
    } catch (e) {
      vscode.window.showErrorMessage(`Sign in failed: ${e}`);
      throw e;
    }
  }

  /**
   * Remove an existing session
   * @param sessionId 
   */
  public async removeSession(sessionId: string): Promise<void> {
    
  }

  /**
   * Dispose the registered services
   */
  public async dispose() {
    this._disposable.dispose();
  }

  private login(scopes: string[] = []) {
    return vscode.window.withProgress<string>({
      location: vscode.ProgressLocation.Notification,
      title: "Signing in to Twitch...",
      cancellable: true
    }, async (_, token) => {
      const stateId = randomUUID();      
      //this._pendingStates.push(stateId);

      const scopeString = scopes.join(' ');

      const uri = vscode.Uri.parse("https://www.google.com");
      await vscode.env.openExternal(uri);

      try {
        return await Promise.race([
          new Promise<string>((_, reject) => setTimeout(() => reject('Cancelled'), 60000)),
        ]);
      } finally {
        //this._pendingStates = this._pendingStates.filter(n => n !== stateId);
      }
    });
  }
}