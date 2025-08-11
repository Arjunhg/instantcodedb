import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Zap, Database, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
export default function Home() {
   
  return (
    <div className=" z-20 flex flex-col items-center justify-start min-h-screen py-2 mt-10">
      
      <div className="flex flex-col justify-center items-center my-5">
      <Image src={"/hero.svg"} alt="Hero-Section" height={500}  width={500}/>
      
      <h1 className=" z-20 text-6xl mt-5 font-extrabold text-center bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-red-500 to-pink-500 dark:from-rose-400 dark:via-red-400 dark:to-pink-400 tracking-tight leading-[1.3] ">
        Vibe Code With Intelligence
      </h1>
      </div>
     
      {/* HACKATHON: Added Redis performance highlights */}
      <div className="flex flex-row gap-6 mb-6">
        <div className="flex items-center gap-2 bg-green-500/10 px-4 py-2 rounded-lg">
          <Zap className="h-5 w-5 text-green-400" />
          <span className="text-green-400 font-semibold">95% Faster AI</span>
        </div>
        <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-lg">
          <Database className="h-5 w-5 text-blue-400" />
          <span className="text-blue-400 font-semibold">Redis Powered</span>
        </div>
        <div className="flex items-center gap-2 bg-purple-500/10 px-4 py-2 rounded-lg">
          <Clock className="h-5 w-5 text-purple-400" />
          <span className="text-purple-400 font-semibold">50ms Response</span>
        </div>
      </div>

      <p className="mt-2 text-lg text-center text-gray-600 dark:text-gray-400 px-5 py-10 max-w-2xl">
        InstantCodeDB is a powerful and intelligent code editor with Redis-powered semantic caching 
        that reduces AI response times from 3000ms to 50ms. Experience blazing-fast code completion 
        and AI assistance with 95% performance improvement.
      </p>
      
      <div className="flex gap-4">
        <Link href={"/dashboard"}>
          <Button variant={"brand"} className="mb-4" size={"lg"}>
            Start Coding Now
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
        <Link href={"/cache-demo"}>
          <Button variant={"outline"} className="mb-4" size={"lg"}>
            Test Redis Performance
            <Database className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
