// HACKATHON: Temporarily disabled auth for demo
// import { useSession } from "next-auth/react";

export const useCurrentUser = ()=>{
    // HACKATHON: Return mock user for demo
    return {
        id: "demo-user-id",
        name: "Demo User",
        email: "demo@instantcodedb.com",
        image: null,
        role: "USER"
    };
    
    // Original auth code (commented for hackathon)
    // const session = useSession();
    // return session?.data?.user
}