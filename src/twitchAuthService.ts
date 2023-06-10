import { readFileSync } from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';
import * as request from 'request';
import { randomUUID } from 'crypto';
import {
  EXTENSION_ID,
  TWITCH_AUTHORIZE_URL,
  TWITCH_CLIENT_ID,
  TWITCH_REVOKE_URL,
  TWITCH_SERVER_PORT,
  TWITCH_VALIDATION_URL
} from './constants';

export class TwitchAuthService {
  public static async validateToken(token: string) {
    const result = await new Promise<{valid: Boolean, login: string}>((resolve, reject) => {
      request.get(TWITCH_VALIDATION_URL, {
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'Authorization': `OAuth ${token}`
        }
      }, (err: any, response: any, body: any) => {
        if (err) {
          reject(err);
        } else {
          if (response.statusCode === 200) {
            const json = JSON.parse(body);
            resolve({valid: true, login: json.login});
          } else {
            resolve({valid: false, login: ''});
          }
        }
      });
    });
    return result;
  }
  public static async revokeToken(token: string) {
    const url = `${TWITCH_REVOKE_URL}?client_id=${TWITCH_CLIENT_ID}&token=${token}`;
    const result = await new Promise<boolean>((resolve, reject) => {
      request.post(url, {auth: { 'bearer': token }}, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.statusCode === 200);
        }
      });
    });
    return result;
  }
}