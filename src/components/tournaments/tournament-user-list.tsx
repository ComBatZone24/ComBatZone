
import type { TournamentPlayer } from '@/types'; // TournamentPlayer is now the value in the object map
import { ShieldAlert, UserCircle } from 'lucide-react'; 
import GlassCard from '@/components/core/glass-card';

interface TournamentUserListProps {
  players: TournamentPlayer[]; // Now expects an array of TournamentPlayer, derived from the object
  maxPlayers: number;
}

const TournamentUserList: React.FC<TournamentUserListProps> = ({ players, maxPlayers }) => {
  if (!players || players.length === 0) {
    return (
      <GlassCard className="p-4">
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
          <ShieldAlert className="w-12 h-12 mb-2" />
          <p className="text-center">No players have joined this tournament yet.</p>
          <p className="text-xs">Be the first to join!</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4">
      <h3 className="text-lg font-semibold mb-3 text-foreground">
        Joined Players ({players.length}/{maxPlayers})
      </h3>
      <div className="max-h-96 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {players.map((player, index) => (
          <div key={player.uid || index} className="flex items-center justify-between p-3 bg-background/50 rounded-lg shadow-sm hover:bg-accent/10 transition-colors">
            <div className="flex items-center space-x-3">
              <UserCircle className="h-10 w-10 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground text-sm">{player.username || 'Unknown Player'}</p>
                <p className="text-xs text-muted-foreground">UID: {player.uid?.substring(0, 10)}...</p>
              </div>
            </div>
            {/* Display Kills if available */}
            {player.kills !== undefined && player.kills !== null &&
              <div className="text-sm text-accent font-semibold">{player.kills} Kills</div>}
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

export default TournamentUserList;
