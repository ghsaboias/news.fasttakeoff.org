import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// const isProtectedRoute = createRouteMatcher(["/current-events(.*)", "/executive-orders(.*)"]);
const isProtectedRoute = createRouteMatcher([]);

export default clerkMiddleware(
    async (auth, req) => {
        if (isProtectedRoute(req)) {
            await auth.protect();
        }
    },
    { signInUrl: "/sign-in", signUpUrl: "/sign-up" }
);

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};