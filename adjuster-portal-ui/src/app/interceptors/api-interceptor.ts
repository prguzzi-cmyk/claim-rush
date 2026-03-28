import { Injectable } from "@angular/core";
import { HttpErrorResponse, HttpHandler, HttpInterceptor, HttpRequest } from "@angular/common/http";
import { BehaviorSubject, Observable, throwError } from "rxjs";
import { AuthService } from "../services/auth.service";
import { catchError, filter, finalize, switchMap, take } from "rxjs/operators";
import { environment } from "../../environments/environment";

function go2ShopMgmtModule(url: string) {
  return url?.startsWith("accounts")
      || url?.startsWith("categories")
      || url?.startsWith("products")
      || url.startsWith("carts")
      || url.startsWith("orders");
}

function go2MLMMgmtModule(url: string) {
  return url?.startsWith("mlm");
}


@Injectable()
export class ApiInterceptor implements HttpInterceptor {
  private refreshingToken = false;
  private refreshTokenSubject: BehaviorSubject<any> =
    new BehaviorSubject<string>(null);

  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<any> {
    return next
      .handle(this.addTokenToRequest(request, this.authService.getToken()))
      .pipe(
        catchError((error) => {
          if (error instanceof HttpErrorResponse) {
            // TODO: REMOVE - DEV ONLY: Skip auth error handling when no token
            if (!this.authService.getToken()) {
              return throwError(error);
            }

            switch ((<HttpErrorResponse>error).status) {
              case 401:
                // Check if the refresh token has expired
                if (
                  error.error.message ==
                  "Token has expired and can no longer be refreshed"
                ) {
                  // Log out if the refresh token has expired
                  return <any>this.authService.logout();
                }
                // Handle the unauthorised request
                return this.handleUnautharisedRequest(
                  request,
                  next,
                  this.authService.getToken()
                );

              case 400:
                return <any>this.authService.logout();

              case 409:
                return throwError(error);
            }

            // Other HTTP errors
            return throwError(error);
          } else {
            return throwError(error);
          }
        })
      );
  }

  private handleUnautharisedRequest(
    request: HttpRequest<any>,
    next: HttpHandler,
    token: string
  ) {
    // Check if it's already refreshing the token
    if (!this.refreshingToken) {
      // Flag as refreshing
      this.refreshingToken = true;
      this.refreshTokenSubject.next(null);

      // Refresh token
      return this.authService.refreshToken().pipe(
        switchMap((data) => {
          this.refreshTokenSubject.next(this.authService.getToken());
          return next.handle(
            this.addTokenToRequest(request, this.authService.getToken())
          );
        }),
        catchError((err) => {
          return <any>this.authService.logout();
        }),
        finalize(() => {
          this.refreshingToken = false;
        })
      );
    } else {
      return this.refreshTokenSubject.pipe(
        filter((token) => token != null),
        take(1),
        switchMap((token) => {
          return next.handle(this.addTokenToRequest(request, token));
        })
      );
    }
  }

  private addTokenToRequest(
    request: HttpRequest<any>,
    token: string
  ): HttpRequest<any> {
    let url = this.dispatchUrl2BackendApps(request);

    // TODO: REMOVE - DEV ONLY: Skip auth header when no token
    if (!token) {
      return request.clone({ url: url });
    }

    return request.clone({
      url: url,
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  private dispatchUrl2BackendApps(request: HttpRequest<any>) {
    const url = request?.url?.toLowerCase();
    if (go2MLMMgmtModule(url)) {
      return `${environment.mlmServer}/${request?.url}`;
    } else {
      return `${environment.server}/${request?.url}`;
    }
  }
}
