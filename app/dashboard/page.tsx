import AddNewButton from "@/features/dashboard/components/add-new-btn";
// import AddRepo from "@/features/dashboard/components/add-repo";
import ProjectTableWrapper from "@/features/dashboard/components/project-table-wrapper";
import { getAllPlaygroundForUser } from "@/features/playground/actions";

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-16">
    <img src="/empty-state.svg" alt="No projects" className="w-48 h-48 mb-4" />
    <h2 className="text-xl font-semibold text-gray-500">No projects found</h2>
    <p className="text-gray-400">Create a new project to get started!</p>
  </div>
);

const DashboardMainPage = async () => {
  const playgrounds = await getAllPlaygroundForUser();
  console.log(playgrounds);
  return (
    <div className="flex flex-col justify-start items-center min-h-screen mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-row md:justify-center justify-between items-center w-full">
        <AddNewButton />
        {/* <AddRepo /> */}
      </div>
      <div className="mt-10 flex flex-col justify-center items-center w-full">
        {playgrounds && playgrounds.length === 0 ? (
          <EmptyState />
        ) : (
          <ProjectTableWrapper projects={playgrounds || []} />
        )}
      </div>
    </div>
  );
};

export default DashboardMainPage;
