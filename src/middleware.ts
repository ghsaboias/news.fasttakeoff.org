import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/current-events(.*)", "/executive-orders(.*)"]);

export default clerkMiddleware(
    async (auth, req) => {
        if (isProtectedRoute(req)) {
            const { userId } = await auth();
            console.log("Middleware: userId=", userId, "URL=", req.url); // Debug
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