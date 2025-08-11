"use client";

import { deleteProjectById, editProjectById, duplicateProjectById } from "@/features/playground/actions";
import ProjectTable from "./project-table";
import type { Project } from "../types";

interface ProjectTableWrapperProps {
  projects: Project[];
}

export default function ProjectTableWrapper({ projects }: ProjectTableWrapperProps) {
  // Wrapper functions to handle the server actions
  const handleDeleteProject = async (id: string): Promise<void> => {
    await deleteProjectById(id);
  };

  const handleUpdateProject = async (
    id: string,
    data: { title: string; description: string }
  ): Promise<void> => {
    await editProjectById(id, data);
  };

  const handleDuplicateProject = async (id: string): Promise<void> => {
    await duplicateProjectById(id);
  };

  return (
    <ProjectTable
      projects={projects}
      onDeleteProject={handleDeleteProject}
      onUpdateProject={handleUpdateProject}
      onDuplicateProject={handleDuplicateProject}
    />
  );
}
