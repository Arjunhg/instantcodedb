"use server";

// HACKATHON: Temporarily disabled auth
// import { auth } from "@/auth";
import { db } from "@/lib/db";


export const getUserById = async (id:string)=>{
    try {
        const user = await db.user.findUnique({
            where:{id},
            include:{accounts:true}
        })
        return user
    } catch (error) {
        console.log(error)
        return null
    }
}

export const getAccountByUserId = async (userId:string)=>{
    try {
        const account = await db.account.findFirst({
            where:{
                userId
            }
        })
        return account
    } catch (error) {
        console.log(error)
        return null
    }
}

export const currentUser = async()=>{
    // HACKATHON: Temporarily bypass auth for demo
    // Return a mock user for all operations
    return {
        id: "demo-user-id",
        name: "Demo User",
        email: "demo@instantcodedb.com",
        image: null,
        role: "USER"
    };
    
    // Original auth code (commented for hackathon)
    // const user = await auth()
    // return user?.user;
}