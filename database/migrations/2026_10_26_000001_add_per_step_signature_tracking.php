<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_route_steps', function (Blueprint $table) {
            $table->boolean('signature_required')->default(false)->after('status');
            $table->string('signature_status', 30)->default('not_required')->after('signature_required');
            $table->timestamp('signed_at')->nullable()->after('signature_status');
            $table->foreignId('signed_by')->nullable()->after('signed_at')->constrained('users')->nullOnDelete();
        });

        $stepsToRequire = DB::table('document_route_steps')
            ->join('document_routes', 'document_routes.id', '=', 'document_route_steps.document_route_id')
            ->join('documents', 'documents.id', '=', 'document_routes.document_id')
            ->where('documents.signature_status', '<>', 'not_required')
            ->whereIn('document_route_steps.status', ['waiting', 'available', 'in_progress', 'waiting_on_branch'])
            ->select(['document_route_steps.id', 'document_route_steps.signed_document_file_id', 'document_route_steps.decided_at'])
            ->get();

        foreach ($stepsToRequire as $step) {
            DB::table('document_route_steps')->where('id', $step->id)->update([
                'signature_required' => true,
                'signature_status' => $step->signed_document_file_id !== null ? 'signed' : 'needs_signature',
                'signed_at' => $step->signed_document_file_id !== null ? $step->decided_at : null,
            ]);
        }

        $parallelRouteIds = DB::table('document_routes')
            ->join('documents', 'documents.id', '=', 'document_routes.document_id')
            ->where('documents.signature_status', '<>', 'not_required')
            ->where('document_routes.status', 'pending')
            ->where('document_routes.mode', 'parallel')
            ->pluck('document_routes.id');

        foreach ($parallelRouteIds as $routeId) {
            DB::table('document_routes')->where('id', $routeId)->update(['mode' => 'sequential']);
            $steps = DB::table('document_route_steps')->where('document_route_id', $routeId)->orderBy('position')->get();
            $firstOpenStep = $steps->first(fn ($step) => in_array($step->status, ['waiting', 'available', 'in_progress', 'waiting_on_branch'], true));

            foreach ($steps as $step) {
                if (! in_array($step->status, ['waiting', 'available', 'in_progress', 'waiting_on_branch'], true)) {
                    continue;
                }

                if ($step->id === $firstOpenStep?->id) {
                    continue;
                }

                DB::table('document_route_steps')->where('id', $step->id)->update(['status' => 'waiting']);
            }

            if ($firstOpenStep && ! in_array($firstOpenStep->status, ['available', 'in_progress', 'waiting_on_branch'], true)) {
                DB::table('document_route_steps')->where('id', $firstOpenStep->id)->update(['status' => 'available']);
            }
        }
    }

    public function down(): void
    {
        Schema::table('document_route_steps', function (Blueprint $table) {
            $table->dropForeign(['signed_by']);
            $table->dropColumn(['signature_required', 'signature_status', 'signed_at', 'signed_by']);
        });
    }
};
