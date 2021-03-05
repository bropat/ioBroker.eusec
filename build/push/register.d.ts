import { Logger } from "ts-log";
import { CheckinResponse, Credentials, FidInstallationResponse, FidTokenResponse, GcmRegisterResponse } from "./models";
export declare class PushRegisterService {
    private readonly APP_PACKAGE;
    private readonly APP_ID;
    private readonly APP_SENDER_ID;
    private readonly APP_CERT_SHA1;
    private readonly FCM_PROJECT_ID;
    private readonly GOOGLE_API_KEY;
    private readonly AUTH_VERSION;
    private log;
    constructor(log?: Logger);
    private buildExpiresAt;
    registerFid(fid: string): Promise<FidInstallationResponse>;
    renewFidToken(fid: string, refreshToken: string): Promise<FidTokenResponse>;
    createPushCredentials(): Promise<Credentials>;
    renewPushCredentials(credentials: Credentials): Promise<Credentials>;
    loginPushCredentials(credentials: Credentials): Promise<Credentials>;
    executeCheckin(): Promise<CheckinResponse>;
    registerGcm(fidInstallationResponse: FidInstallationResponse, checkinResponse: CheckinResponse): Promise<GcmRegisterResponse>;
}
