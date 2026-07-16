import { PatronCardContainer } from '../../../components/student/patron-card/PatronCardContainer';

const PatronCard = () => {
  return (
    <div className="space-y-6 max-w-xl mx-auto px-4 py-6">
      <div className="border-b border-edge/20 pb-4 text-center">
        <h1 className="text-3xl font-serif font-bold text-ink">Digital Library Pass</h1>
        <p className="text-sm text-muted mt-1">
          Use this digital card at librarian checkout counters and lab scanners.
        </p>
      </div>

      <PatronCardContainer />
    </div>
  );
};

export default PatronCard;
